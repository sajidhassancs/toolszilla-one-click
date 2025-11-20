import {
    getOldestQueueJob,
    updateJobStatus,
    updateJobResult,
    removeQueueJob
} from './stealthWriterQueue.js';
import axios from 'axios';
import { getDataFromApiWithoutVerify } from './apiService.js';

let isProcessing = false;
let isSolvingPuzzle = false;

/**
 * Process a single job through StealthWriter API
 */
async function processJob(email, requestData) {
    try {
        console.log(`\n⚙️ Processing job for: ${email}`);

        // Get cookies from API
        const apiData = await getDataFromApiWithoutVerify('stealthwriter');
        let cookiesArray = apiData.access_configuration_preferences[0].accounts[0];

        if (typeof cookiesArray === 'string') {
            cookiesArray = JSON.parse(cookiesArray);
        }

        if (!Array.isArray(cookiesArray) || cookiesArray.length === 0) {
            throw new Error('No cookies available');
        }

        const cookieString = cookiesArray.map(c => `${c.name}=${c.value}`).join('; ');
        console.log(`   🍪 Using ${cookiesArray.length} cookies`);

        // Determine which endpoint to use
        const isAlternatives = requestData.rehumanizeRequest === true;
        const endpoint = isAlternatives
            ? 'https://app.stealthwriter.ai/api/humanize/alternatives'
            : 'https://app.stealthwriter.ai/api/humanize';

        console.log(`   📤 Sending request to ${isAlternatives ? 'alternatives' : 'humanize'}...`);

        const response = await axios({
            method: 'POST',
            url: endpoint,
            headers: {
                'accept': '*/*',
                'accept-language': 'en-GB,en-US;q=0.9,en;q=0.8',
                'content-type': 'application/json',
                'referer': 'https://app.stealthwriter.ai/humanizer',
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Cookie': cookieString
            },
            data: requestData,
            validateStatus: () => true,
            timeout: 60000
        });

        console.log(`   ✅ Response status: ${response.status}`);

        // Check if we got a 403 (puzzle required)
        if (response.status === 403) {
            console.log('   🧩 Got 403 - puzzle detected!');

            const puzzleSolved = await solvePuzzle(cookieString);

            if (puzzleSolved) {
                console.log('   🔄 Retrying request after puzzle solve...');

                const retryResponse = await axios({
                    method: 'POST',
                    url: endpoint,
                    headers: {
                        'accept': '*/*',
                        'accept-language': 'en-GB,en-US;q=0.9,en;q=0.8',
                        'content-type': 'application/json',
                        'referer': 'https://app.stealthwriter.ai/humanizer',
                        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                        'Cookie': cookieString
                    },
                    data: requestData,
                    validateStatus: () => true,
                    timeout: 60000
                });

                console.log(`   ✅ Retry response: ${retryResponse.status}`);

                return {
                    success: true,
                    status: retryResponse.status,
                    response: retryResponse.data
                };
            } else {
                throw new Error('Failed to solve puzzle');
            }
        }

        return {
            success: true,
            status: response.status,
            response: response.data
        };

    } catch (error) {
        console.error(`   ❌ Job processing error: ${error.message}`);
        throw error;
    }
}

/**
 * Solve StealthWriter puzzle
 */
async function solvePuzzle(cookieString) {
    isSolvingPuzzle = true;
    console.log('   🧩 Solving puzzle...');

    try {
        console.log('   📥 Fetching puzzle challenge...');

        const puzzleResponse = await axios({
            method: 'POST',
            url: 'https://app.stealthwriter.ai/humanizer',
            headers: {
                'accept': 'text/x-component',
                'accept-language': 'en-GB,en-US;q=0.9,en;q=0.8',
                'content-type': 'text/plain;charset=UTF-8',
                'next-action': process.env.NEXT_ACTION_GET_PUZZLE || '602b50e2a3239b324ba0fd4dc86e40ea7d9b0c91e9',
                'next-router-state-tree': '%5B%22%22%2C%7B%22children%22%3A%5B%22(dashboard-ui)%22%2C%7B%22children%22%3A%5B%22humanizer%22%2C%7B%22children%22%3A%5B%22__PAGE__%22%2C%7B%7D%2Cnull%2Cnull%5D%7D%2Cnull%2Cnull%5D%7D%2Cnull%2Cnull%5D%7D%2Cnull%2Cnull%2Ctrue%5D',
                'referer': 'https://app.stealthwriter.ai/humanizer',
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Cookie': cookieString
            },
            data: JSON.stringify([]),
            validateStatus: () => true
        });

        const puzzleData = puzzleResponse.data;
        console.log('   ✅ Got puzzle response');

        if (!puzzleData.includes('challenge')) {
            console.log('   ⚠️ No challenge found in response');
            return false;
        }

        // Extract puzzle data
        const challengeMatch = puzzleData.match(/"challenge":\s*\{\s*"targetX":\s*(\d+),\s*"targetY":\s*(\d+)\s*\}/);
        const tokenMatch = puzzleData.match(/"token":\s*"([^"]+)"/);

        if (!challengeMatch || !tokenMatch) {
            console.log('   ⚠️ Could not parse puzzle data');
            return false;
        }

        const targetX = parseInt(challengeMatch[1]);
        const targetY = parseInt(challengeMatch[2]);
        const token = tokenMatch[1];

        console.log(`   🎯 Puzzle: X=${targetX}, Y=${targetY}`);
        console.log(`   🔑 Token: ${token.substring(0, 50)}...`);

        console.log('   📤 Submitting puzzle solution...');

        const solutionResponse = await axios({
            method: 'POST',
            url: 'https://app.stealthwriter.ai/humanizer',
            headers: {
                'accept': 'text/x-component',
                'accept-language': 'en-GB,en-US;q=0.9,en;q=0.8',
                'content-type': 'text/plain;charset=UTF-8',
                'next-action': process.env.NEXT_ACTION_SOLVE_PUZZLE || '602b50e2a3239b324ba0fd4dc86e40ea7d9b0c91e9',
                'next-router-state-tree': '%5B%22%22%2C%7B%22children%22%3A%5B%22(dashboard-ui)%22%2C%7B%22children%22%3A%5B%22humanizer%22%2C%7B%22children%22%3A%5B%22__PAGE__%22%2C%7B%7D%2Cnull%2Cnull%5D%7D%2Cnull%2Cnull%5D%7D%2Cnull%2Cnull%5D%7D%2Cnull%2Cnull%2Ctrue%5D',
                'referer': 'https://app.stealthwriter.ai/humanizer',
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Cookie': cookieString
            },
            data: JSON.stringify([token, targetX, targetY]),
            validateStatus: () => true
        });

        console.log(`   ✅ Puzzle solved! Status: ${solutionResponse.status}`);
        return true;

    } catch (error) {
        console.error(`   ❌ Puzzle solve error: ${error.message}`);
        return false;
    } finally {
        isSolvingPuzzle = false;
    }
}

/**
 * Main queue processor loop
 */
export async function startQueueProcessor() {
    if (isProcessing) {
        console.log('⚠️ Queue processor already running');
        return;
    }

    isProcessing = true;
    console.log('🚀 StealthWriter Queue Processor started');

    while (true) {
        try {
            // Pause if solving puzzle
            if (isSolvingPuzzle) {
                console.log('⏸️  Queue paused - solving puzzle...');
                await new Promise(resolve => setTimeout(resolve, 1000));
                continue;
            }

            // Get next job
            const job = await getOldestQueueJob();

            if (!job) {
                await new Promise(resolve => setTimeout(resolve, 2000));
                continue;
            }

            console.log(`\n📋 Found job for: ${job.email}`);
            await updateJobStatus(job.email, 'in_progress');

            try {
                const result = await processJob(job.email, job.data);

                await updateJobResult(job.email, result);
                await updateJobStatus(job.email, 'completed');

                console.log(`✅ Job completed for: ${job.email}`);

                // Clean up after 60 seconds
                setTimeout(async () => {
                    await removeQueueJob(job.email);
                    console.log(`🗑️  Cleaned up completed job for: ${job.email}`);
                }, 60000);

            } catch (error) {
                console.error(`❌ Job failed for ${job.email}:`, error.message);

                await updateJobResult(job.email, {
                    error: error.message,
                    success: false
                });
                await updateJobStatus(job.email, 'failed');

                setTimeout(async () => {
                    await removeQueueJob(job.email);
                    console.log(`🗑️  Cleaned up failed job for: ${job.email}`);
                }, 30000);
            }

        } catch (error) {
            console.error('❌ Queue processor error:', error.message);
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }
}