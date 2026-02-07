
export type UserRole = 'consumer' | 'specialist';

export type OrderStatus = 'new' | 'confirmed' | 'in_progress' | 'done' | 'cancelled';

export interface Profile {
  id: string;
  user_id: string;
  role: UserRole;
  full_name: string;
  avatar_url?: string;
  city?: string;
  bio?: string;
  category_id?: string;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  name: string;
  created_at: string;
}

export interface Service {
  id: string;
  specialist_profile_id: string;
  category_id: string;
  title: string;
  description: string;
  price: number;
  currency: string;
  rating_avg: number;
  rating_count: number;
  is_active: boolean;
  created_at: string;
  specialist?: Profile;
  category?: Category;
}

export interface Order {
  id: string;
  consumer_profile_id: string;
  specialist_profile_id: string;
  service_id: string;
  status: OrderStatus;
  scheduled_at: string;
  address: string;
  comment?: string;
  created_at: string;
  updated_at: string;
  service?: Service;
  consumer?: Profile;
  specialist?: Profile;
}
