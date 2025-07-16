# CodeCraft Studio

[![CodeCraft Studio: Your AI-Powered Development Companion](./public/social_preview_index.jpg)](https://codecraft.studio)

Welcome to **CodeCraft Studio**, an enhanced and mobile-optimized AI-powered development platform. Originally based on bolt.diy, CodeCraft Studio has been completely redesigned with superior mobile responsiveness, enhanced UI/UX, and powerful new features for modern developers.

## ✨ What's New in CodeCraft Studio

### 🎯 **Enhanced Mobile Experience**
- **Complete Mobile Responsiveness**: Optimized for all device sizes from phones to desktop
- **Touch-Friendly Interface**: Improved touch targets and gestures for mobile devices  
- **Mobile-First Design**: Redesigned layout that works seamlessly on mobile
- **Responsive Navigation**: Smart sidebar and workbench that adapt to screen size
- **Touch Optimizations**: Better scrolling, zooming, and interaction handling

### 🎨 **Modern UI/UX Improvements**
- **Sleek New Design**: Modern, clean interface with improved typography and spacing
- **Enhanced Visual Hierarchy**: Better organization and readability across all components
- **Improved Accessibility**: Better contrast, focus states, and keyboard navigation
- **Smooth Animations**: Polished micro-interactions and transitions
- **Dark/Light Mode**: Optimized themes for both desktop and mobile

### 🚀 **Functional Enhancements**
- **Better Performance**: Optimized for faster loading and smoother interactions
- **Enhanced Chat Experience**: Improved mobile chat interface with better input handling
- **Responsive Workbench**: Code editor and preview that adapts to any screen size
- **Touch-Friendly Controls**: All buttons and controls optimized for touch interaction
- **Mobile Deployment**: Fixed container deployment issues for mobile devices

### 🛠 **Technical Improvements**
- **Advanced Mobile Detection**: Smart device detection and responsive layout switching
- **Touch Gesture Support**: Enhanced touch and gesture handling
- **Improved Viewport Handling**: Better mobile viewport configuration
- **Safe Area Support**: Proper handling of notches and safe areas on modern devices
- **Performance Optimizations**: Faster rendering and better memory management

---

## 🌟 Key Features

**CodeCraft Studio** allows you to choose the LLM that you use for each prompt! Currently supports:
- OpenAI, Anthropic, Ollama, OpenRouter
- Gemini, LMStudio, Mistral, xAI  
- HuggingFace, DeepSeek, Groq models
- Easily extensible to any Vercel AI SDK supported model

### Core Capabilities
- ⚡ **Full-Stack Development**: Build complete applications in your browser
- 📱 **Mobile-First**: Perfect experience on phones, tablets, and desktop
- 🎨 **Modern UI**: Beautiful, responsive interface with smooth animations  
- 🤖 **AI-Powered**: Multiple LLM providers for maximum flexibility
- 🚀 **Instant Deployment**: Deploy directly to Netlify, Vercel, and more
- 💾 **Cloud Sync**: Save and restore your projects anywhere

---

## 📋 Table of Contents

- [Mobile Improvements](#mobile-improvements)
- [Setup](#setup)
- [Run the Application](#run-the-application)
- [Available Scripts](#available-scripts)
- [Mobile Deployment](#mobile-deployment)
- [Contributing](#contributing)
- [FAQ](#faq)

## 📱 Mobile Improvements

CodeCraft Studio has been completely rebuilt with mobile-first principles:

### Responsive Design
- **Breakpoints**: Smart responsive breakpoints (mobile: ≤768px, tablet: 769-1024px, desktop: >1024px)
- **Adaptive Layout**: Components automatically adjust for optimal mobile experience
- **Touch Optimization**: All interactive elements sized appropriately for touch

### Mobile Navigation  
- **Smart Sidebar**: Collapsible sidebar with overlay on mobile
- **Mobile Workbench**: Full-screen code editor experience on mobile
- **Gesture Support**: Swipe gestures for navigation and panel management

### Performance
- **Optimized Loading**: Faster initial load times on mobile networks
- **Efficient Rendering**: Reduced battery drain and improved performance
- **Smart Caching**: Better caching strategies for mobile devices

---

## 🚀 Setup

1. Clone CodeCraft Studio:
```bash
git clone https://github.com/your-org/codecraft-studio.git
cd codecraft-studio
```

2. Install dependencies:
```bash
pnpm install
```

3. Set up environment variables:
```bash
cp .env.example .env.local
# Add your API keys
```

## 🏃 Run the Application

### Development Mode
```bash
pnpm run dev
```

### Mobile Testing
For testing mobile functionality:
```bash
pnpm run dev -- --host 0.0.0.0
```
Then access via your phone using your computer's IP address.

### Production Build  
```bash
pnpm run build
pnpm run start
```

### Docker Deployment (Mobile-Optimized)
```bash
# Build mobile-optimized container
pnpm run dockerbuild

# Run with mobile support
pnpm run dockerrun
```

## 📱 Mobile Deployment

CodeCraft Studio is optimized for mobile deployment:

### Container Deployment
```bash
# Build production container
docker build -t codecraft-studio:latest .

# Run with mobile optimization
docker run -p 5173:5173 --env-file .env.local codecraft-studio:latest
```

### Environment Configuration
Ensure your deployment platform is configured for mobile:
- Enable gzip compression
- Set proper mobile viewport headers
- Configure touch event handling
- Enable hardware acceleration

---

## 🤝 Contributing

We welcome contributions to CodeCraft Studio! Please see our [Contributing Guidelines](./CONTRIBUTING.md) for details.

### Development Guidelines
- Follow mobile-first development practices
- Test on multiple device sizes
- Ensure touch accessibility
- Maintain performance standards

---

## ❓ FAQ

### Mobile-Specific Questions

**Q: Does CodeCraft Studio work on all mobile devices?**
A: Yes! CodeCraft Studio is tested and optimized for iOS Safari, Chrome Mobile, Firefox Mobile, and other major mobile browsers.

**Q: Can I develop full applications on my phone?**
A: Absolutely! The mobile interface provides a complete development environment including code editing, preview, and deployment.

**Q: How do I access the code editor on mobile?**
A: The workbench automatically adapts to mobile screens. Tap the code icon to open the full-screen mobile editor.

**Q: Are touch gestures supported?**
A: Yes! CodeCraft Studio includes comprehensive touch gesture support for navigation, code editing, and panel management.

### General Questions

**Q: What's the difference between CodeCraft Studio and bolt.diy?**
A: CodeCraft Studio is a completely redesigned version with superior mobile responsiveness, enhanced UI/UX, better performance, and many new features while maintaining full compatibility with the original functionality.

**Q: Can I import my existing bolt.diy projects?**
A: Yes! CodeCraft Studio maintains full compatibility with bolt.diy projects and configurations.

---

## 📜 License

MIT License - see [LICENSE](./LICENSE) for details.

---

## 🙏 Acknowledgments

CodeCraft Studio builds upon the excellent foundation of bolt.diy by [Cole Medin](https://www.youtube.com/@ColeMedin) and the amazing open source community. Special thanks to all contributors who made this enhanced mobile experience possible!

---

**🚀 Ready to craft amazing applications? [Get started with CodeCraft Studio today!](https://codecraft.studio)**
