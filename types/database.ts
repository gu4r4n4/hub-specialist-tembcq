
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
  icon_material?: string;
  icon_sf?: string;
  description?: string;
  display_order?: number;
  color?: string;
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
  city?: string;
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

export interface SpecialistPortfolioImage {
  id: string;
  specialist_profile_id: string;
  image_url: string;
  sort_order: number;
  title: string | null;
  created_at: string;
}

export interface OrderStatusHistory {
  id: string;
  order_id: string;
  old_status: OrderStatus | null;
  new_status: OrderStatus;
  changed_by: string;
  created_at: string;
}

export interface Chat {
  id: string;
  consumer_profile_id: string;
  specialist_profile_id: string;
  service_id: string;
  created_at: string;
  updated_at: string;
  service?: Service;
  consumer?: Profile;
  specialist?: Profile;
}

export interface Message {
  id: string;
  chat_id: string;
  sender_profile_id: string;
  content: string;
  is_read: boolean;
  created_at: string;
}
