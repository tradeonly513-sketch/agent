import {
  Accessibility,
  Focus,
  Table,
  Search,
  Link,
  User,
  CheckSquare,
  Moon,
  Globe2,
  FileText,
  Code2,
  GitBranch,
  Keyboard,
  Layers,
  BarChart3,
  MapPin,
  Image,
  Users,
  Menu,
  FormInput,
  Type,
  Languages,
  ShieldAlert,
  Smartphone,
  BookOpen,
  TestTube,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface ActionPrompt {
  id: string;
  title: string;
  description: string;
  prompt: string;
  icon: LucideIcon;
  category: string;
  tags: string[];
}

export interface PromptCategory {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  color: string;
}

export const PROMPT_CATEGORIES: PromptCategory[] = [
  {
    id: 'accessibility',
    title: 'Accessibility',
    description: 'Improve app accessibility and inclusive design',
    icon: Accessibility,
    color: 'text-green-500',
  },
  {
    id: 'seo',
    title: 'SEO',
    description: 'Search engine optimization and discoverability',
    icon: Search,
    color: 'text-blue-500',
  },
  {
    id: 'usability',
    title: 'Usability',
    description: 'Enhance user experience and interface design',
    icon: User,
    color: 'text-purple-500',
  },
  {
    id: 'misc',
    title: 'Misc',
    description: 'General improvements and features',
    icon: Code2,
    color: 'text-orange-500',
  },
  {
    id: 'workflow',
    title: 'Workflow',
    description: 'Development workflow and documentation',
    icon: FileText,
    color: 'text-teal-500',
  },
];

export const ACTION_PROMPTS: ActionPrompt[] = [
  // Accessibility Category
  {
    id: 'keyboard-navigation-audit',
    title: 'Keyboard Navigation Audit',
    description: 'Comprehensive review of keyboard accessibility',
    prompt:
      'Please conduct a comprehensive keyboard navigation audit of this application. Check for:\n\n1. Tab order and logical flow\n2. Focus indicators visibility\n3. Skip links and navigation shortcuts\n4. Keyboard traps and focus management\n5. ARIA labels and roles for interactive elements\n\nProvide specific recommendations for improvements and code examples where needed.',
    icon: Keyboard,
    category: 'accessibility',
    tags: ['keyboard', 'navigation', 'audit', 'a11y'],
  },
  {
    id: 'focus-management-spa',
    title: 'Focus Management for Single Page Applications',
    description: 'Implement proper focus management for SPAs',
    prompt:
      'Help me implement proper focus management for this single-page application. Include:\n\n1. Focus restoration after modal/dialog closure\n2. Announcing route changes to screen readers\n3. Managing focus during dynamic content updates\n4. Implementing focus traps for modal dialogs\n5. Handling focus for infinite scroll and lazy loading\n\nProvide code examples and best practices.',
    icon: Focus,
    category: 'accessibility',
    tags: ['focus', 'spa', 'screen-reader', 'modal'],
  },
  {
    id: 'accessible-data-tables',
    title: 'Accessible Data Tables',
    description: 'Create fully accessible data table components',
    prompt:
      'Help me create accessible data tables with:\n\n1. Proper table headers and scope attributes\n2. Caption and summary information\n3. Sortable columns with clear indicators\n4. Keyboard navigation between cells\n5. Screen reader announcements for table updates\n6. Responsive table design for mobile devices\n\nInclude ARIA attributes and semantic HTML structure.',
    icon: Table,
    category: 'accessibility',
    tags: ['tables', 'data', 'responsive', 'aria'],
  },
  {
    id: 'accessible-rich-text',
    title: 'Accessible Rich Text Content',
    description: 'Make rich text editors and content accessible',
    prompt:
      'Help me make rich text content and editors fully accessible:\n\n1. Proper heading hierarchy (h1-h6)\n2. Alternative text for images and media\n3. Accessible form labels and descriptions\n4. Color contrast compliance\n5. Text alternatives for icons and graphics\n6. Structured content with semantic markup\n\nProvide guidelines for content creators and technical implementation.',
    icon: Type,
    category: 'accessibility',
    tags: ['rich-text', 'content', 'images', 'contrast'],
  },
  {
    id: 'aria-landmark-regions',
    title: 'ARIA Landmark Regions',
    description: 'Implement proper landmark regions for navigation',
    prompt:
      'Help me implement ARIA landmark regions to improve navigation:\n\n1. Main content area identification\n2. Navigation regions and menus\n3. Complementary content (sidebars)\n4. Search functionality landmarks\n5. Banner and contentinfo regions\n6. Application and document regions\n\nProvide semantic HTML structure and ARIA role implementation.',
    icon: MapPin,
    category: 'accessibility',
    tags: ['aria', 'landmarks', 'navigation', 'regions'],
  },

  // SEO Category
  {
    id: 'internal-linking-strategy',
    title: 'Internal Linking Strategy',
    description: 'Optimize internal link structure for SEO',
    prompt:
      'Help me develop an effective internal linking strategy:\n\n1. Identify key pages and content clusters\n2. Create contextual internal links\n3. Optimize anchor text for SEO\n4. Implement breadcrumb navigation\n5. Build topic clusters and pillar pages\n6. Audit existing internal link structure\n\nProvide implementation guidelines and content strategy recommendations.',
    icon: Link,
    category: 'seo',
    tags: ['links', 'strategy', 'navigation', 'content'],
  },
  {
    id: 'header-hierarchy-optimization',
    title: 'Header Hierarchy Optimization',
    description: 'Optimize heading structure for SEO and accessibility',
    prompt:
      'Help me optimize the heading hierarchy for both SEO and accessibility:\n\n1. Audit current heading structure (H1-H6)\n2. Ensure logical heading progression\n3. Optimize H1 tags for primary keywords\n4. Create descriptive and keyword-rich headings\n5. Implement structured data for headings\n6. Balance SEO needs with readability\n\nProvide specific recommendations and code examples.',
    icon: Layers,
    category: 'seo',
    tags: ['headings', 'structure', 'keywords', 'hierarchy'],
  },
  {
    id: 'local-seo-implementation',
    title: 'Local SEO Implementation',
    description: 'Implement local SEO features and schema markup',
    prompt:
      'Help me implement local SEO optimization:\n\n1. Local business schema markup\n2. Google My Business integration\n3. Local keyword optimization\n4. Location-based landing pages\n5. Customer reviews and testimonials\n6. Local citations and NAP consistency\n7. Geographic targeting implementation\n\nProvide technical implementation and content strategy.',
    icon: Globe2,
    category: 'seo',
    tags: ['local', 'schema', 'business', 'location'],
  },
  {
    id: 'content-readability-analysis',
    title: 'Content Readability Analysis',
    description: 'Analyze and improve content readability for SEO',
    prompt:
      'Help me analyze and improve content readability:\n\n1. Flesch-Kincaid readability assessment\n2. Sentence and paragraph length optimization\n3. Use of transition words and phrases\n4. Passive voice identification and reduction\n5. Complex word replacement suggestions\n6. Content structure and formatting\n\nProvide analysis tools and improvement recommendations.',
    icon: BarChart3,
    category: 'seo',
    tags: ['readability', 'content', 'analysis', 'writing'],
  },
  {
    id: 'image-seo-enhancement',
    title: 'Image SEO Enhancement',
    description: 'Optimize images for search engines and performance',
    prompt:
      'Help me optimize images for SEO and performance:\n\n1. Descriptive alt text and file names\n2. Image compression and format optimization\n3. Responsive images implementation\n4. Image schema markup\n5. Lazy loading implementation\n6. Image sitemap creation\n7. WebP format adoption\n\nProvide technical implementation and optimization strategies.',
    icon: Image,
    category: 'seo',
    tags: ['images', 'optimization', 'performance', 'alt-text'],
  },

  // Usability Category
  {
    id: 'form-simplification',
    title: 'Form Simplification',
    description: 'Simplify and optimize form user experience',
    prompt:
      'Help me simplify and optimize form user experience:\n\n1. Reduce form fields to essentials\n2. Implement smart field validation\n3. Add helpful placeholder text and labels\n4. Create multi-step forms for complex data\n5. Implement auto-save and progress indicators\n6. Optimize for mobile form completion\n7. Add clear error messaging and recovery\n\nProvide UX best practices and implementation examples.',
    icon: FormInput,
    category: 'usability',
    tags: ['forms', 'validation', 'mobile', 'ux'],
  },
  {
    id: 'navigation-menu-optimization',
    title: 'Navigation Menu Optimization',
    description: 'Optimize navigation menus for better usability',
    prompt:
      'Help me optimize navigation menus for better usability:\n\n1. Information architecture review\n2. Menu hierarchy and organization\n3. Mobile-first navigation design\n4. Search functionality integration\n5. Breadcrumb navigation implementation\n6. Mega menu vs. dropdown considerations\n7. User testing and analytics integration\n\nProvide design patterns and implementation guidelines.',
    icon: Menu,
    category: 'usability',
    tags: ['navigation', 'menu', 'mobile', 'architecture'],
  },
  {
    id: 'input-validation-ux',
    title: 'Input Validation UX',
    description: 'Improve input validation user experience',
    prompt:
      'Help me improve input validation user experience:\n\n1. Real-time validation feedback\n2. Clear and helpful error messages\n3. Progressive enhancement approach\n4. Success state indicators\n5. Contextual help and tooltips\n6. Accessibility considerations for errors\n7. Mobile-optimized validation patterns\n\nProvide implementation examples and UX patterns.',
    icon: CheckSquare,
    category: 'usability',
    tags: ['validation', 'errors', 'feedback', 'mobile'],
  },
  {
    id: 'inclusive-design-patterns',
    title: 'Inclusive Design Patterns',
    description: 'Implement inclusive design principles',
    prompt:
      'Help me implement inclusive design patterns:\n\n1. Color-blind friendly color schemes\n2. High contrast mode support\n3. Reduced motion preferences\n4. Font size and spacing flexibility\n5. Multiple interaction methods\n6. Cultural and language considerations\n7. Cognitive accessibility features\n\nProvide design guidelines and technical implementation.',
    icon: Users,
    category: 'usability',
    tags: ['inclusive', 'accessibility', 'design', 'preferences'],
  },
  {
    id: 'microcopy-optimization',
    title: 'Microcopy Optimization',
    description: 'Optimize interface copy and messaging',
    prompt:
      'Help me optimize microcopy and interface messaging:\n\n1. Button labels and call-to-action text\n2. Error message tone and clarity\n3. Empty state messaging\n4. Loading and progress indicators\n5. Confirmation dialogs and alerts\n6. Onboarding and help text\n7. Brand voice consistency\n\nProvide copywriting guidelines and examples.',
    icon: Type,
    category: 'usability',
    tags: ['copy', 'messaging', 'buttons', 'errors'],
  },

  // Misc Category
  {
    id: 'dark-mode-implementation',
    title: 'Dark Mode Implementation',
    description: 'Add comprehensive dark mode support',
    prompt:
      'Help me implement comprehensive dark mode support:\n\n1. CSS custom properties for theming\n2. System preference detection\n3. Theme persistence and user choice\n4. Image and icon adaptations\n5. Accessibility considerations (contrast ratios)\n6. Smooth theme transitions\n7. Component-level theme awareness\n\nProvide complete implementation with toggle functionality.',
    icon: Moon,
    category: 'misc',
    tags: ['dark-mode', 'theming', 'css', 'preferences'],
  },
  {
    id: 'internationalization-setup',
    title: 'Internationalization Setup',
    description: 'Set up i18n for multiple languages',
    prompt:
      'Help me set up internationalization (i18n) for this application:\n\n1. Choose and configure i18n library\n2. Extract strings for translation\n3. Implement language switching\n4. Handle RTL (right-to-left) languages\n5. Format dates, numbers, and currencies\n6. Manage pluralization rules\n7. Set up translation workflow\n\nProvide technical setup and best practices.',
    icon: Languages,
    category: 'misc',
    tags: ['i18n', 'translation', 'localization', 'rtl'],
  },
  {
    id: 'error-handling-strategy',
    title: 'Error Handling Strategy',
    description: 'Implement comprehensive error handling',
    prompt:
      'Help me implement a comprehensive error handling strategy:\n\n1. Global error boundary implementation\n2. API error handling and retry logic\n3. User-friendly error messages\n4. Error logging and monitoring\n5. Offline state management\n6. Graceful degradation patterns\n7. Recovery mechanisms and fallbacks\n\nProvide implementation patterns and user experience considerations.',
    icon: ShieldAlert,
    category: 'misc',
    tags: ['errors', 'handling', 'monitoring', 'offline'],
  },
  {
    id: 'web-app-manifest',
    title: 'Web App Manifest Generator',
    description: 'Create PWA manifest and service worker',
    prompt:
      'Help me create a Progressive Web App (PWA) setup:\n\n1. Generate web app manifest file\n2. Configure app icons and splash screens\n3. Set up service worker for caching\n4. Implement offline functionality\n5. Add install prompts\n6. Configure push notifications\n7. Optimize for mobile app-like experience\n\nProvide complete PWA implementation.',
    icon: Smartphone,
    category: 'misc',
    tags: ['pwa', 'manifest', 'service-worker', 'offline'],
  },

  // Workflow Category
  {
    id: 'component-documentation-template',
    title: 'Component Documentation Template',
    description: 'Create standardized component documentation',
    prompt:
      'Help me create a standardized component documentation template:\n\n1. Component API and props documentation\n2. Usage examples and code snippets\n3. Accessibility guidelines\n4. Design system integration\n5. Testing examples and scenarios\n6. Performance considerations\n7. Migration guides and changelog\n\nProvide documentation structure and tooling recommendations.',
    icon: BookOpen,
    category: 'workflow',
    tags: ['documentation', 'components', 'api', 'examples'],
  },
  {
    id: 'testing-strategy-setup',
    title: 'Testing Strategy Setup',
    description: 'Implement comprehensive testing strategy',
    prompt:
      'Help me set up a comprehensive testing strategy:\n\n1. Unit testing with Jest/Vitest\n2. Component testing with Testing Library\n3. Integration and E2E testing setup\n4. Visual regression testing\n5. Accessibility testing automation\n6. Performance testing benchmarks\n7. CI/CD testing pipeline\n\nProvide testing setup and best practices.',
    icon: TestTube,
    category: 'workflow',
    tags: ['testing', 'automation', 'ci-cd', 'quality'],
  },
  {
    id: 'code-review-checklist',
    title: 'Code Review Checklist',
    description: 'Create systematic code review process',
    prompt:
      'Help me create a systematic code review checklist:\n\n1. Code quality and style guidelines\n2. Performance and optimization checks\n3. Security vulnerability assessment\n4. Accessibility compliance review\n5. Test coverage and quality\n6. Documentation requirements\n7. Breaking changes evaluation\n\nProvide checklist template and automation tools.',
    icon: GitBranch,
    category: 'workflow',
    tags: ['code-review', 'quality', 'checklist', 'standards'],
  },
  {
    id: 'performance-monitoring-setup',
    title: 'Performance Monitoring Setup',
    description: 'Implement performance monitoring and analytics',
    prompt:
      'Help me set up performance monitoring and analytics:\n\n1. Core Web Vitals tracking\n2. Bundle size analysis and optimization\n3. Runtime performance monitoring\n4. User experience metrics\n5. Error tracking and reporting\n6. A/B testing infrastructure\n7. Performance budgets and alerts\n\nProvide monitoring tools and implementation strategy.',
    icon: BarChart3,
    category: 'workflow',
    tags: ['performance', 'monitoring', 'analytics', 'optimization'],
  },
];

export const getPromptsByCategory = (categoryId: string): ActionPrompt[] => {
  return ACTION_PROMPTS.filter((prompt) => prompt.category === categoryId);
};

export const searchPrompts = (query: string): ActionPrompt[] => {
  const lowercaseQuery = query.toLowerCase();
  return ACTION_PROMPTS.filter(
    (prompt) =>
      prompt.title.toLowerCase().includes(lowercaseQuery) ||
      prompt.description.toLowerCase().includes(lowercaseQuery) ||
      prompt.tags.some((tag) => tag.toLowerCase().includes(lowercaseQuery)),
  );
};
