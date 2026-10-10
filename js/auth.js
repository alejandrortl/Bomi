// js/auth.js

async function loginUser(email, password) {
    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email: email,
            password: password,
        });

        if (error) throw error;
        return { success: true, data };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

async function logoutUser() {
    await supabase.auth.signOut();
    window.location.reload();
}

async function checkSession() {
    const { data: { session } } = await supabase.auth.getSession();
    return session;
}