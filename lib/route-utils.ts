// Utility functions for route-to-program mapping

export type ProgramValue = 
  | 'Foundation/Professional' 
  | 'All' 
  | 'PreDiploma' 
  | 'Diploma' 
  | 'DiplomaPartTime' 
  | 'Bachelor' 
  | 'BachelorPartTime' 
  | 'Master' 
  | 'PhD';

// Map route segment to program value
export function getProgramFromRoute(route: string | null | undefined): ProgramValue {
  if (!route) return 'All';
  
  const routeMap: Record<string, ProgramValue> = {
    'foundation-professional': 'Foundation/Professional',
    'pre-diploma': 'PreDiploma',
    'diploma': 'Diploma',
    'diploma-part-time': 'DiplomaPartTime',
    'bachelor': 'Bachelor',
    'bachelor-part-time': 'BachelorPartTime',
    'master': 'Master',
    'phd': 'PhD',
  };
  
  return routeMap[route] || 'All';
}

// Map program value to route segment
export function getRouteFromProgram(program: ProgramValue): string {
  const programMap: Record<ProgramValue, string> = {
    'Foundation/Professional': 'foundation-professional',
    'All': '',
    'PreDiploma': 'pre-diploma',
    'Diploma': 'diploma',
    'DiplomaPartTime': 'diploma-part-time',
    'Bachelor': 'bachelor',
    'BachelorPartTime': 'bachelor-part-time',
    'Master': 'master',
    'PhD': 'phd',
  };
  
  return programMap[program] || '';
}

// Get route path for a program and view mode
export function getRoutePath(program: ProgramValue, viewMode: 'grid' | 'list'): string {
  const routeSegment = getRouteFromProgram(program);
  
  if (program === 'All') {
    // Homepage routes
    return viewMode === 'grid' ? '/' : '/list';
  }
  
  // Program-specific routes
  const basePath = `/${routeSegment}`;
  return viewMode === 'grid' ? basePath : `${basePath}/list`;
}

// Check if route is valid
export function isValidProgramRoute(route: string | null | undefined): boolean {
  if (!route) return true; // Empty route means "All"
  
  const validRoutes = [
    'foundation-professional',
    'pre-diploma',
    'diploma',
    'diploma-part-time',
    'bachelor',
    'bachelor-part-time',
    'master',
    'phd',
  ];
  
  return validRoutes.includes(route);
}

// Get display name for a program route
export function getProgramDisplayName(route: string | null | undefined): string {
  if (!route) return 'All';
  
  const displayNameMap: Record<string, string> = {
    'foundation-professional': 'Foundation/Professional',
    'pre-diploma': 'Pre-Diploma',
    'diploma': 'Diploma',
    'diploma-part-time': 'Diploma (Part-Time)',
    'bachelor': 'Bachelor',
    'bachelor-part-time': 'Bachelor (Part-Time)',
    'master': 'Master',
    'phd': 'PhD',
  };
  
  return displayNameMap[route] || 'All';
}

// OG image path for social preview by route (program slug or null for default)
export function getOgImageForRoute(route: string | null | undefined): string {
  if (!route) return '/all.png';
  const imageMap: Record<string, string> = {
    'foundation-professional': '/foundation.png',
    'pre-diploma': '/pre-diploma.png',
    'diploma': '/diploma.png',
    'diploma-part-time': '/diploma-part-time.png',
    'bachelor': '/bachelor.png',
    'bachelor-part-time': '/bachelor-part-time.png',
    'master': '/master.png',
    'phd': '/phd.png',
  };
  return imageMap[route] ?? '/all.png';
}
