# Contributing to CodeCraft Studio

Thank you for your interest in contributing to **CodeCraft Studio**! We're excited to have you help make AI-powered development more accessible and mobile-friendly for everyone.

## 🎯 Our Mission

CodeCraft Studio aims to provide the best AI-powered development experience across all devices, with particular focus on mobile-first design and accessibility. We believe powerful development tools should work seamlessly whether you're on a phone, tablet, or desktop.

## 📱 Mobile-First Development

Since CodeCraft Studio prioritizes mobile experience, all contributions should consider mobile users:

### Mobile Development Guidelines
- **Touch-first design**: All interactive elements should be touch-friendly (44px minimum)
- **Responsive layouts**: Test on mobile, tablet, and desktop viewports
- **Performance**: Optimize for mobile networks and devices
- **Accessibility**: Ensure features work with screen readers and assistive tech
- **Cross-browser**: Test on iOS Safari, Chrome Mobile, and Firefox Mobile

### Testing on Mobile
Before submitting, please test your changes on:
- **Mobile Chrome** (Android)
- **Safari** (iOS)
- **Different screen sizes** (phones, tablets)
- **Both orientations** (portrait and landscape)
- **Touch interactions** (tap, swipe, pinch)

## 🚀 Getting Started

### Prerequisites
- **Node.js** 20 or higher
- **pnpm** package manager
- **Git** for version control
- **Mobile device** or browser dev tools for testing

### Development Setup

1. **Fork and Clone**
   ```bash
   git clone https://github.com/your-username/codecraft-studio.git
   cd codecraft-studio
   ```

2. **Install Dependencies**
   ```bash
   pnpm install
   ```

3. **Start Development Server**
   ```bash
   pnpm run dev
   ```

4. **Test Mobile Experience**
   ```bash
   # Enable mobile testing
   pnpm run dev -- --host 0.0.0.0
   # Access via your phone using your computer's IP
   ```

## 📋 How to Contribute

### 🐛 Reporting Bugs

When reporting bugs, especially mobile-related ones, please include:

- **Device information** (iPhone 15, Samsung Galaxy S24, iPad Pro, etc.)
- **Browser and version** (Safari 17.1, Chrome 119, etc.)
- **Screen size/resolution**
- **Orientation** (portrait/landscape)
- **Steps to reproduce**
- **Expected vs actual behavior**
- **Screenshots/videos** if applicable
- **Console errors** from browser dev tools

### ✨ Suggesting Features

We love feature suggestions! Please:

- **Check existing issues** first
- **Consider mobile impact** - how will this work on phones?
- **Provide use cases** - real scenarios where this helps
- **Include mockups** for UI changes
- **Think about accessibility** - how do screen readers interact?

### 🔧 Making Code Changes

#### Mobile-Specific Contributions
We especially welcome:
- **Mobile UI improvements**
- **Touch gesture enhancements**
- **Performance optimizations**
- **Accessibility improvements**
- **Cross-browser compatibility fixes**
- **Mobile-specific features**

#### Before You Start
1. **Check existing issues** or create one to discuss your idea
2. **Fork the repository**
3. **Create a feature branch** from `main`
4. **Follow our coding standards**

#### Code Standards

**TypeScript/JavaScript**
- Use **TypeScript** for all new code
- Follow **ESLint** and **Prettier** configurations
- Add **JSDoc comments** for complex functions
- Use **meaningful variable names**

**React Components**
- Use **functional components** with hooks
- Implement **proper error boundaries**
- Ensure **accessibility** (ARIA labels, keyboard navigation)
- Make components **responsive by default**

**CSS/Styling**
- Use **UnoCSS/Tailwind** classes when possible
- Follow **mobile-first** responsive design
- Ensure **44px minimum touch targets**
- Test **dark/light themes**
- Support **high contrast** modes

**Mobile-Specific Code**
```typescript
// Good: Mobile-first responsive design
className="text-sm md:text-base lg:text-lg"

// Good: Touch-friendly interactions
className="min-h-[44px] min-w-[44px] touch-manipulation"

// Good: Mobile detection
import { isMobile } from '~/utils/mobile';
```

#### Testing Requirements

All contributions must include:

1. **Unit Tests** (where applicable)
   ```bash
   pnpm run test
   ```

2. **Type Checking**
   ```bash
   pnpm run typecheck
   ```

3. **Linting**
   ```bash
   pnpm run lint
   pnpm run lint:fix
   ```

4. **Mobile Testing**
   - Test on actual mobile devices
   - Verify touch interactions
   - Check performance on slower devices
   - Ensure accessibility compliance

#### Pull Request Process

1. **Create descriptive PR title**
   - `feat: add mobile gesture navigation`
   - `fix: improve mobile chat scrolling`
   - `docs: update mobile setup guide`

2. **Write comprehensive description**
   - What does this change?
   - Why is it needed?
   - How does it affect mobile users?
   - Any breaking changes?

3. **Include screenshots/videos**
   - Before/after comparisons
   - Mobile device demonstrations
   - Different screen sizes

4. **Request appropriate reviewers**
   - Tag maintainers familiar with changed areas
   - Request mobile-focused review if applicable

## 🎨 Design Guidelines

### Mobile UI Principles
- **Thumb-friendly**: Important actions within thumb reach
- **Clear hierarchy**: Obvious content organization
- **Minimal taps**: Reduce steps to complete tasks
- **Forgiveness**: Easy undo/back functionality
- **Feedback**: Clear response to user actions

### Responsive Breakpoints
```scss
// Mobile first approach
.component {
  // Mobile (default)
  padding: 1rem;
  
  // Tablet
  @media (min-width: 768px) {
    padding: 1.5rem;
  }
  
  // Desktop
  @media (min-width: 1024px) {
    padding: 2rem;
  }
}
```

### Touch Targets
- **Minimum size**: 44x44px
- **Spacing**: 8px between touch targets
- **Visual feedback**: Hover/active states
- **Gesture support**: Swipe, pinch, long-press where appropriate

## 🛠 Technical Architecture

### Key Areas for Contribution

**Mobile Store** (`app/lib/stores/mobile.ts`)
- Mobile state management
- Device detection
- Responsive behavior

**Mobile Components**
- Touch-friendly UI components
- Responsive layouts
- Mobile-specific interactions

**Performance**
- Bundle optimization
- Mobile network considerations
- Battery usage optimization

**Accessibility**
- Screen reader support
- High contrast modes
- Keyboard navigation
- Voice control compatibility

## 📚 Resources

### Learning Materials
- **Mobile Web Best Practices**: [web.dev/mobile](https://web.dev/mobile/)
- **Touch Design Guidelines**: [Material Design Touch](https://material.io/design/usability/accessibility.html)
- **React Mobile Patterns**: [React Native Web](https://necolas.github.io/react-native-web/)

### Testing Tools
- **Chrome DevTools**: Mobile device simulation
- **BrowserStack**: Real device testing
- **Lighthouse**: Performance and accessibility audits
- **axe-core**: Accessibility testing

## 🤝 Community

### Communication Channels
- **GitHub Issues**: Bug reports and feature requests
- **Discussions**: General questions and ideas
- **Pull Requests**: Code contributions and reviews

### Getting Help
- **Stuck on mobile implementation?** Open a discussion
- **Need design guidance?** Tag design-focused maintainers
- **Performance questions?** Include profiling data

## 🎉 Recognition

Contributors are recognized through:
- **GitHub contributors page**
- **Release notes mentions**
- **Community highlights**
- **Contributor badges**

We especially celebrate:
- **First-time contributors**
- **Mobile experience improvements**
- **Accessibility enhancements**
- **Performance optimizations**

## 📝 Code of Conduct

We maintain a welcoming, inclusive environment:
- **Be respectful** of different viewpoints and experiences
- **Be patient** with newcomers and different skill levels
- **Be constructive** in feedback and criticism
- **Focus on the best outcome** for the community

## 🚀 Ready to Contribute?

1. **Find an issue** tagged `good-first-issue` or `mobile`
2. **Comment** that you'd like to work on it
3. **Fork and code** following our guidelines
4. **Test thoroughly** on mobile devices
5. **Submit your PR** with detailed description

**Questions?** Don't hesitate to ask! We're here to help you contribute successfully.

---

**Thank you for helping make CodeCraft Studio the best mobile-first AI development platform!** 🎉

Together, we're building the future of accessible, powerful development tools that work beautifully on every device.
