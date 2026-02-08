
// Category icon mapping for cross-platform support
// Maps category names to platform-specific icon names

export interface CategoryIconMapping {
  icon_material: string; // Material Icons for Android/Web
  icon_sf: string;       // SF Symbols for iOS
}

// Icon mapping by category name
export const CATEGORY_ICON_MAP: Record<string, CategoryIconMapping> = {
  'Home Cleaning': {
    icon_material: 'brush',
    icon_sf: 'paintbrush.fill',
  },
  'Handyman / Repairs': {
    icon_material: 'handyman',
    icon_sf: 'wrench.and.screwdriver.fill',
  },
  'Plumbing': {
    icon_material: 'plumbing',
    icon_sf: 'drop.fill',
  },
  'Electrical': {
    icon_material: 'bolt',
    icon_sf: 'bolt.fill',
  },
  'Painting': {
    icon_material: 'format-paint',
    icon_sf: 'paintbrush.fill',
  },
  'Moving & Delivery': {
    icon_material: 'local-shipping',
    icon_sf: 'truck.box.fill',
  },
  'Appliance Repair': {
    // screwdriver/repair
    icon_material: 'build',
    icon_sf: 'wrench.and.screwdriver.fill',
  },
  'Computer / IT Support': {
    icon_material: 'computer',
    icon_sf: 'laptopcomputer',
  },
  'Phone Repair': {
    // phone
    icon_material: 'phone',
    icon_sf: 'phone.fill',
  },
  'Beauty: Hair & Makeup': {
    // scissors
    icon_material: 'content-cut',
    icon_sf: 'scissors',
  },
  'Nails / Manicure': {
    icon_material: 'spa',
    icon_sf: 'hands.sparkles',
  },
  'Massage & Wellness': {
    // hand
    icon_material: 'pan-tool',
    icon_sf: 'hand.raised.fill',
  },
  'Fitness Trainer': {
    // dumbbells
    icon_material: 'fitness-center',
    icon_sf: 'dumbbell.fill',
  },
  'Tutoring': {
    icon_material: 'school',
    icon_sf: 'book.fill',
  },
  'Photography': {
    icon_material: 'photo-camera',
    icon_sf: 'camera.fill',
  },
  'Event Services': {
    icon_material: 'event',
    icon_sf: 'calendar',
  },
  'Car Wash / Detailing': {
    // car
    icon_material: 'directions-car',
    icon_sf: 'car.fill',
  },
  'Pet Services': {
    icon_material: 'pets',
    icon_sf: 'pawprint.fill',
  },
  'Gardening / Landscaping': {
    icon_material: 'yard',
    icon_sf: 'leaf.fill',
  },
  'Babysitting / Nanny': {
    icon_material: 'child-care',
    icon_sf: 'figure.and.child.holdinghands',
  },
};

// Normalize icon names coming from DB/seeds.
// Some sources use underscores (e.g., "local_shipping"), while @expo/vector-icons
// MaterialIcons typically expects hyphens (e.g., "local-shipping").
export function normalizeMaterialIconName(iconName: string): string {
  return iconName.replace(/_/g, '-');
}

// Helper function to get icons for a category
export function getCategoryIcons(categoryName: string): CategoryIconMapping {
  const mapping = CATEGORY_ICON_MAP[categoryName];

  if (mapping) {
    return mapping;
  }

  // Fallback icons if category not found in mapping
  return {
    icon_material: 'category',
    icon_sf: 'square.grid.2x2',
  };
}
