import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load dotenv
dotenv.config({ path: path.join(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function main() {
  const email = process.env.PLAYWRIGHT_TEST_USER_EMAIL || 'test-unigram@example.com';
  const password = process.env.PLAYWRIGHT_TEST_USER_PASSWORD || 'TestPass123!';

  console.log(`Seeding test user: ${email}...`);

  try {
    // 1. Get user list to see if they exist
    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
    if (listError) throw listError;

    let user = users.find(u => u.email === email);

    if (user) {
      console.log(`User exists with ID: ${user.id}. Updating email confirmation and password...`);
      const { data: updatedUser, error: updateError } = await supabase.auth.admin.updateUserById(
        user.id,
        {
          email_confirm: true,
          password: password,
          user_metadata: { full_name: 'Unigram Test User' }
        }
      );
      if (updateError) throw updateError;
      user = updatedUser.user;
    } else {
      console.log(`User does not exist. Creating new confirmed user...`);
      const { data: createdUser, error: createError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: 'Unigram Test User' }
      });
      if (createError) throw createError;
      user = createdUser.user;
    }

    console.log(`User setup complete. ID: ${user.id}. Upserting profile...`);

    // 2. Ensure profile exists in profiles table
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({
        id: user.id,
        email: email,
        full_name: 'Unigram Test User',
        role: 'student',
        institution: null
      }, { onConflict: 'id' });

    if (profileError) throw profileError;

    console.log('Test user seeded successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding test user:', error);
    process.exit(1);
  }
}

main();
