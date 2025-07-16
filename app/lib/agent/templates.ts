export interface TaskTemplate {
  id: string;
  title: string;
  description: string;
  category: string;
  prompt: string;
  estimatedSteps: number;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  tags: string[];
}

export const taskTemplates: TaskTemplate[] = [
  {
    id: 'react-todo-app',
    title: 'React Todo App',
    description: 'Create a complete todo application with React, including add, delete, edit, and toggle functionality',
    category: 'Frontend',
    prompt: 'Create a React todo application with the following features: add new todos, delete todos, edit existing todos, mark todos as complete/incomplete, filter todos by status (all, active, completed), and persist data in localStorage. Use modern React hooks and include basic CSS styling.',
    estimatedSteps: 5,
    difficulty: 'intermediate',
    tags: ['react', 'javascript', 'frontend', 'hooks', 'localStorage']
  },
  {
    id: 'express-api',
    title: 'Express REST API',
    description: 'Build a RESTful API server with Express.js including authentication and CRUD operations',
    category: 'Backend',
    prompt: 'Create an Express.js REST API server with the following features: user authentication with JWT, CRUD operations for a resource (e.g., posts or products), middleware for authentication and error handling, input validation, and basic security measures. Include proper route organization and error responses.',
    estimatedSteps: 6,
    difficulty: 'advanced',
    tags: ['express', 'nodejs', 'api', 'jwt', 'authentication', 'backend']
  },
  {
    id: 'python-data-analyzer',
    title: 'Python Data Analyzer',
    description: 'Create a Python script that analyzes CSV data and generates reports with visualizations',
    category: 'Data Science',
    prompt: 'Create a Python data analysis script that reads CSV files, performs statistical analysis, generates summary reports, and creates visualizations using matplotlib or seaborn. Include data cleaning, descriptive statistics, and export results to both text and image formats.',
    estimatedSteps: 4,
    difficulty: 'intermediate',
    tags: ['python', 'pandas', 'matplotlib', 'data-analysis', 'csv']
  },
  {
    id: 'html-portfolio',
    title: 'HTML Portfolio Website',
    description: 'Build a responsive personal portfolio website with HTML, CSS, and JavaScript',
    category: 'Frontend',
    prompt: 'Create a responsive personal portfolio website with HTML, CSS, and JavaScript. Include sections for: header with navigation, about me, skills, projects showcase, contact form, and footer. Make it mobile-responsive with modern CSS techniques and add smooth scrolling and basic animations.',
    estimatedSteps: 4,
    difficulty: 'beginner',
    tags: ['html', 'css', 'javascript', 'responsive', 'portfolio']
  },
  {
    id: 'vue-dashboard',
    title: 'Vue.js Dashboard',
    description: 'Create an admin dashboard with Vue.js including charts, tables, and user management',
    category: 'Frontend',
    prompt: 'Build a Vue.js admin dashboard with the following components: sidebar navigation, header with user menu, dashboard with charts and statistics cards, data tables with sorting and filtering, user management interface, and responsive design. Use Vue 3 composition API and include mock data.',
    estimatedSteps: 7,
    difficulty: 'advanced',
    tags: ['vue', 'dashboard', 'charts', 'admin', 'composition-api']
  },
  {
    id: 'python-web-scraper',
    title: 'Python Web Scraper',
    description: 'Build a web scraper that extracts data from websites and saves it to files',
    category: 'Automation',
    prompt: 'Create a Python web scraper using requests and BeautifulSoup that extracts data from a website (e.g., news articles, product listings), handles pagination, implements rate limiting, saves data to CSV/JSON files, and includes error handling for network issues and missing elements.',
    estimatedSteps: 5,
    difficulty: 'intermediate',
    tags: ['python', 'web-scraping', 'beautifulsoup', 'requests', 'automation']
  },
  {
    id: 'nodejs-cli-tool',
    title: 'Node.js CLI Tool',
    description: 'Create a command-line tool with Node.js for file processing and automation',
    category: 'Tools',
    prompt: 'Build a Node.js command-line tool that processes files in a directory, supports various command-line arguments and options, includes help documentation, handles file operations (read, write, transform), and provides progress feedback. Use commander.js for argument parsing.',
    estimatedSteps: 4,
    difficulty: 'intermediate',
    tags: ['nodejs', 'cli', 'commander', 'file-processing', 'automation']
  },
  {
    id: 'react-weather-app',
    title: 'React Weather App',
    description: 'Build a weather application with React that fetches data from a weather API',
    category: 'Frontend',
    prompt: 'Create a React weather application that fetches weather data from a public API, displays current weather and forecast, allows searching by city name, shows weather icons and detailed information, handles loading states and errors, and includes geolocation support for current location weather.',
    estimatedSteps: 5,
    difficulty: 'intermediate',
    tags: ['react', 'api', 'weather', 'geolocation', 'async']
  },
  {
    id: 'python-flask-blog',
    title: 'Flask Blog Application',
    description: 'Create a blog application with Flask including user authentication and post management',
    category: 'Full Stack',
    prompt: 'Build a Flask blog application with user registration and login, create/edit/delete blog posts, comment system, user profiles, admin panel, database integration with SQLAlchemy, form validation with WTForms, and basic styling with Bootstrap.',
    estimatedSteps: 8,
    difficulty: 'advanced',
    tags: ['flask', 'python', 'sqlalchemy', 'authentication', 'blog', 'full-stack']
  },
  {
    id: 'javascript-game',
    title: 'JavaScript Browser Game',
    description: 'Create an interactive browser game using vanilla JavaScript and HTML5 Canvas',
    category: 'Game Development',
    prompt: 'Create a simple browser game (e.g., Snake, Pong, or Breakout) using vanilla JavaScript and HTML5 Canvas. Include game mechanics, score tracking, collision detection, game over conditions, restart functionality, and keyboard/mouse controls. Add sound effects and animations.',
    estimatedSteps: 6,
    difficulty: 'intermediate',
    tags: ['javascript', 'canvas', 'game', 'animation', 'browser']
  }
];

export const getTemplatesByCategory = (category: string): TaskTemplate[] => {
  return taskTemplates.filter(template => template.category === category);
};

export const getTemplatesByDifficulty = (difficulty: string): TaskTemplate[] => {
  return taskTemplates.filter(template => template.difficulty === difficulty);
};

export const getTemplatesByTag = (tag: string): TaskTemplate[] => {
  return taskTemplates.filter(template => template.tags.includes(tag));
};

export const searchTemplates = (query: string): TaskTemplate[] => {
  const lowercaseQuery = query.toLowerCase();
  return taskTemplates.filter(template => 
    template.title.toLowerCase().includes(lowercaseQuery) ||
    template.description.toLowerCase().includes(lowercaseQuery) ||
    template.tags.some(tag => tag.toLowerCase().includes(lowercaseQuery))
  );
};

export const getTemplateById = (id: string): TaskTemplate | undefined => {
  return taskTemplates.find(template => template.id === id);
};

export const getAllCategories = (): string[] => {
  return [...new Set(taskTemplates.map(template => template.category))];
};

export const getAllTags = (): string[] => {
  return [...new Set(taskTemplates.flatMap(template => template.tags))];
};
