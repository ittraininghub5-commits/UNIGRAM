import { Profile } from '@/src/types';
import { supabase } from '@/src/lib/supabase';

export const authService = {
  async getProfile(userId: string) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (error) throw error;
    if (!data) throw new Error('Profile not found');
    return data as Profile;
  },

  async updateProfile(profile: Partial<Profile>) {
    if (!profile.id) throw new Error('Profile ID is required');
    
    const { data, error } = await supabase
      .from('profiles')
      .update(profile)
      .eq('id', profile.id)
      .select()
      .single();
    
    if (error) throw error;
    if (!data) throw new Error('Failed to update profile');
    return data as Profile;
  },

  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }
};
