import { supabase } from './supabaseClient.js';

/**
 * Add job to queue
 */
export async function addQueueJob(email, data) {
    try {
        // Check if user already has a pending job (not deleted)
        const { data: existing } = await supabase
            .from('stealthwriter_queue')
            .select('id')
            .eq('email', email)
            .in('status', ['pending', 'in_progress'])
            .is('deleted_at', null)  // ✅ Only check non-deleted jobs
            .single();

        if (existing) {
            console.log(`⚠️ Job already exists for ${email}`);
            return false;
        }

        // Add new job
        const { error } = await supabase
            .from('stealthwriter_queue')
            .insert([
                {
                    email: email,
                    data: data,
                    status: 'pending'
                }
            ]);

        if (error) throw error;

        console.log(`✅ Added job to queue for ${email}`);
        return true;
    } catch (error) {
        console.error('❌ Error adding job:', error.message);
        return false;
    }
}

/**
 * Get oldest pending job (not deleted)
 */
export async function getOldestQueueJob() {
    try {
        const { data, error } = await supabase
            .from('stealthwriter_queue')
            .select('*')
            .eq('status', 'pending')
            .is('deleted_at', null)  // ✅ Only get non-deleted jobs
            .order('created_at', { ascending: true })
            .limit(1)
            .single();

        if (error) {
            if (error.code === 'PGRST116') return null; // No rows found
            throw error;
        }

        return data;
    } catch (error) {
        console.error('❌ Error getting job:', error.message);
        return null;
    }
}

/**
 * Get job by email (not deleted)
 */
export async function getJobByEmail(email) {
    try {
        const { data, error } = await supabase
            .from('stealthwriter_queue')
            .select('*')
            .eq('email', email)
            .is('deleted_at', null)  // ✅ Only get non-deleted jobs
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (error) {
            if (error.code === 'PGRST116') return null;
            throw error;
        }

        return data;
    } catch (error) {
        console.error('❌ Error getting job by email:', error.message);
        return null;
    }
}

/**
 * Update job status
 */
export async function updateJobStatus(email, status) {
    try {
        const { error } = await supabase
            .from('stealthwriter_queue')
            .update({
                status: status,
                updated_at: new Date().toISOString()
            })
            .eq('email', email)
            .is('deleted_at', null);  // ✅ Only update non-deleted jobs

        if (error) throw error;

        console.log(`📊 Updated status for ${email}: ${status}`);
    } catch (error) {
        console.error('❌ Error updating status:', error.message);
    }
}

/**
 * Update job result
 */
export async function updateJobResult(email, result) {
    try {
        const { error } = await supabase
            .from('stealthwriter_queue')
            .update({
                result: result,
                updated_at: new Date().toISOString()
            })
            .eq('email', email)
            .is('deleted_at', null);  // ✅ Only update non-deleted jobs

        if (error) throw error;
    } catch (error) {
        console.error('❌ Error updating result:', error.message);
    }
}

/**
 * Soft delete job (mark as deleted instead of removing)
 */
export async function removeQueueJob(email) {
    try {
        const { error } = await supabase
            .from('stealthwriter_queue')
            .update({
                deleted_at: new Date().toISOString()  // ✅ Soft delete
            })
            .eq('email', email)
            .is('deleted_at', null);

        if (error) throw error;

        console.log(`🗑️ Soft deleted job for ${email}`);
    } catch (error) {
        console.error('❌ Error soft deleting job:', error.message);
    }
}

/**
 * Get queue status (only non-deleted)
 */
export async function getQueueStatus() {
    try {
        const { count: total } = await supabase
            .from('stealthwriter_queue')
            .select('*', { count: 'exact', head: true })
            .is('deleted_at', null);  // ✅ Only count non-deleted

        const { count: pending } = await supabase
            .from('stealthwriter_queue')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'pending')
            .is('deleted_at', null);

        const { count: processing } = await supabase
            .from('stealthwriter_queue')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'in_progress')
            .is('deleted_at', null);

        return { total, pending, processing };
    } catch (error) {
        console.error('❌ Error getting queue status:', error.message);
        return { total: 0, pending: 0, processing: 0 };
    }
}

/**
 * Get usage history for a user
 */
export async function getUserHistory(email) {
    try {
        const { data, error } = await supabase
            .from('stealthwriter_queue')
            .select('*')
            .eq('email', email)
            .order('created_at', { ascending: false });

        if (error) throw error;

        return data || [];
    } catch (error) {
        console.error('❌ Error getting user history:', error.message);
        return [];
    }
}

/**
 * Get usage statistics
 */
export async function getUsageStats(email = null) {
    try {
        let query = supabase
            .from('stealthwriter_queue')
            .select('*')
            .eq('status', 'completed');

        if (email) {
            query = query.eq('email', email);
        }

        const { data, error, count } = await query;

        if (error) throw error;

        // Calculate total words processed
        let totalWords = 0;
        data.forEach(job => {
            if (job.data?.text) {
                totalWords += job.data.text.split(' ').length;
            }
        });

        return {
            totalJobs: count || data.length,
            totalWords: totalWords,
            jobs: data
        };
    } catch (error) {
        console.error('❌ Error getting usage stats:', error.message);
        return { totalJobs: 0, totalWords: 0, jobs: [] };
    }
}