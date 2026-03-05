
// Category icon mapping for cross-platform support
// Maps category names to platform-specific icon names

export interface CategoryIconMapping {
  icon_material: string; // Material Icons for Android/Web
  icon_sf: string;       // SF Symbols for iOS
}

// Icon mapping by category name
export const CATEGORY_ICON_MAP: Record<string, CategoryIconMapping> = {
  'Tutors': {
    icon_material: 'school',
    icon_sf: 'graduationcap.fill',
  },
  'Repairmen': {
    icon_material: 'handyman',
    icon_sf: 'hammer.fill',
  },
  'Beauty Masters': {
    icon_material: 'content-cut',
    icon_sf: 'scissors',
  },
  'Freelancers': {
    icon_material: 'computer',
    icon_sf: 'desktopcomputer',
  },
  'Accountants and lawyers': {
    icon_material: 'description',
    icon_sf: 'doc.text.fill',
  },
  'Sports coaches': {
    icon_material: 'emoji-events',
    icon_sf: 'trophy.fill',
  },
  'Artists': {
    icon_material: 'music-note',
    icon_sf: 'music.note',
  },
  'Domestic staff': {
    icon_material: 'auto-awesome',
    icon_sf: 'sparkles',
  },
  'Veterinarians': {
    icon_material: 'pets',
    icon_sf: 'pawprint.fill',
  },
  'Driving instructors': {
    icon_material: 'directions-car',
    icon_sf: 'car.fill',
  },
  'Miscellaneous': {
    icon_material: 'auto-awesome',
    icon_sf: 'sparkles',
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
