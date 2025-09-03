import React, { useState, useEffect } from 'react';
import { Dialog, DialogTitle, DialogDescription, DialogRoot } from './Dialog';
import { Button } from './Button';
import { IconButton } from './IconButton';
import { Card, CardContent, CardHeader } from './Card';
import { Badge } from './Badge';
import { motion, AnimatePresence } from 'framer-motion';
import { classNames } from '~/utils/classNames';
import type { DesignScheme } from '~/types/design-scheme';
import { defaultDesignScheme, designFeatures, designFonts, paletteRoles } from '~/types/design-scheme';
import { Edit, Check, Palette, Type, Wand2, Eye, Copy, RotateCcw, Sparkles, X } from 'lucide-react';

export interface ColorSchemeDialogProps {
  designScheme?: DesignScheme;
  setDesignScheme?: (scheme: DesignScheme) => void;
}

export const ColorSchemeDialog: React.FC<ColorSchemeDialogProps> = ({ setDesignScheme, designScheme }) => {
  const [palette, setPalette] = useState<{ [key: string]: string }>(() => {
    if (designScheme?.palette) {
      return { ...defaultDesignScheme.palette, ...designScheme.palette };
    }

    return defaultDesignScheme.palette;
  });

  const [features, setFeatures] = useState<string[]>(designScheme?.features || defaultDesignScheme.features);
  const [font, setFont] = useState<string[]>(designScheme?.font || defaultDesignScheme.font);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<'colors' | 'typography' | 'features'>('colors');
  const [previewMode, setPreviewMode] = useState(false);
  const [copiedColor, setCopiedColor] = useState<string | null>(null);

  useEffect(() => {
    if (designScheme) {
      setPalette(() => ({ ...defaultDesignScheme.palette, ...designScheme.palette }));
      setFeatures(designScheme.features || defaultDesignScheme.features);
      setFont(designScheme.font || defaultDesignScheme.font);
    } else {
      setPalette(defaultDesignScheme.palette);
      setFeatures(defaultDesignScheme.features);
      setFont(defaultDesignScheme.font);
    }
  }, [designScheme]);

  const copyToClipboard = async (text: string, colorKey: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedColor(colorKey);
      setTimeout(() => setCopiedColor(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleColorChange = (role: string, value: string) => {
    setPalette((prev) => ({ ...prev, [role]: value }));
  };

  const handleFeatureToggle = (key: string) => {
    setFeatures((prev) => (prev.includes(key) ? prev.filter((f) => f !== key) : [...prev, key]));
  };

  const handleFontToggle = (key: string) => {
    setFont((prev) => (prev.includes(key) ? prev.filter((f) => f !== key) : [...prev, key]));
  };

  const handleSave = () => {
    setDesignScheme?.({ palette, features, font });
    setIsDialogOpen(false);
  };

  const handleReset = () => {
    setPalette(defaultDesignScheme.palette);
    setFeatures(defaultDesignScheme.features);
    setFont(defaultDesignScheme.font);
  };

  const renderColorSection = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      {/* Enhanced Header with controls */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-purple-500/10">
            <Palette className="w-4 h-4 text-purple-500" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-bolt-elements-textPrimary">Color Palette</h3>
            <p className="text-xs text-bolt-elements-textSecondary">Customize your design colors</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setPreviewMode(!previewMode)}
            className={classNames(
              'px-3 py-2 text-xs transition-all',
              previewMode
                ? '!bg-purple-500/20 !text-purple-600 border border-purple-500/30'
                : 'text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary !bg-transparent',
            )}
          >
            <Eye className="w-3 h-3 mr-1" />
            Preview
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleReset}
            className="px-3 py-2 text-xs text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary !bg-transparent"
          >
            <RotateCcw className="w-3 h-3 mr-1" />
            Reset
          </Button>
        </div>
      </div>

      {/* Enhanced Color grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-96 overflow-y-auto scrollbar-thin scrollbar-thumb-bolt-elements-bg-depth-3">
        {paletteRoles.map((role, index) => (
          <motion.div
            key={role.key}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
          >
            <Card className="group hover:shadow-md transition-all duration-200 hover:border-purple-500/30">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  {/* Enhanced Color preview */}
                  <div className="relative flex-shrink-0">
                    <motion.div
                      className="w-12 h-12 rounded-xl shadow-lg cursor-pointer ring-2 ring-transparent hover:ring-purple-500/50 transition-all duration-200"
                      style={{ backgroundColor: palette[role.key] }}
                      onClick={() => document.getElementById(`color-input-${role.key}`)?.click()}
                      role="button"
                      tabIndex={0}
                      aria-label={`Change ${role.label} color`}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    />
                    <input
                      id={`color-input-${role.key}`}
                      type="color"
                      value={palette[role.key]}
                      onChange={(e) => handleColorChange(role.key, e.target.value)}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      tabIndex={-1}
                    />
                    <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-bolt-elements-background-depth-1 rounded-full flex items-center justify-center shadow-md border border-bolt-elements-borderColor">
                      <Edit className="w-2.5 h-2.5 text-bolt-elements-textSecondary" />
                    </div>
                  </div>

                  {/* Enhanced Content */}
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-bolt-elements-textPrimary text-sm">{role.label}</h4>
                      <motion.button
                        onClick={() => copyToClipboard(palette[role.key], role.key)}
                        className={classNames(
                          'theme-safe-button p-1.5 rounded-md text-xs',
                          copiedColor === role.key ? '!bg-green-500/20 !text-green-600' : '',
                        )}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        title="Copy color value"
                      >
                        <AnimatePresence mode="wait">
                          {copiedColor === role.key ? (
                            <motion.div key="check" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                              <Check className="w-3 h-3" />
                            </motion.div>
                          ) : (
                            <motion.div key="copy" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                              <Copy className="w-3 h-3" />
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.button>
                    </div>

                    <p className="text-xs text-bolt-elements-textSecondary leading-relaxed">{role.description}</p>

                    <Badge variant="subtle" size="sm" className="font-mono text-xs">
                      {palette[role.key]}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Enhanced Color Preview section */}
      <AnimatePresence>
        {previewMode && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple-500" />
                  <h4 className="text-sm font-semibold text-bolt-elements-textPrimary">Color Preview</h4>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {Object.entries(palette)
                    .slice(0, 8)
                    .map(([key, color]) => (
                      <motion.div
                        key={key}
                        className="text-center"
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.1 }}
                      >
                        <div
                          className="w-full h-10 rounded-lg mb-2 border border-bolt-elements-borderColor shadow-sm"
                          style={{ backgroundColor: color }}
                        ></div>
                        <Badge variant="subtle" size="sm" className="text-xs capitalize">
                          {key}
                        </Badge>
                      </motion.div>
                    ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );

  const renderTypographySection = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-blue-500/10">
          <Type className="w-4 h-4 text-blue-500" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-bolt-elements-textPrimary">Typography</h3>
          <p className="text-xs text-bolt-elements-textSecondary">Choose your font preferences</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-h-80 overflow-y-auto scrollbar-thin scrollbar-thumb-bolt-elements-bg-depth-3">
        {designFonts.map((f, index) => {
          const isSelected = font.includes(f.key);
          return (
            <motion.div
              key={f.key}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card
                className={classNames(
                  'group cursor-pointer transition-all duration-200 hover:shadow-md h-full',
                  isSelected
                    ? 'ring-2 ring-purple-500/30 border-purple-500/60 bg-purple-500/5'
                    : 'hover:border-purple-500/30',
                )}
                onClick={() => handleFontToggle(f.key)}
              >
                <CardContent className="p-4 text-center space-y-3">
                  <div className="relative">
                    <div
                      className={classNames(
                        'text-2xl font-semibold transition-colors',
                        isSelected ? 'text-purple-500' : 'text-bolt-elements-textPrimary',
                      )}
                      style={{ fontFamily: f.key }}
                    >
                      {f.preview}
                    </div>
                    {isSelected && (
                      <div className="absolute -top-1 -right-1 w-5 h-5 bg-purple-500 rounded-full flex items-center justify-center shadow-sm">
                        <Check className="text-white text-xs" />
                      </div>
                    )}
                  </div>

                  <div className="space-y-1">
                    <h4
                      className={classNames(
                        'text-sm font-medium transition-colors',
                        isSelected ? 'text-purple-500' : 'text-bolt-elements-textPrimary',
                      )}
                    >
                      {f.label}
                    </h4>
                    <Badge variant="subtle" size="sm" className="text-xs">
                      {f.key}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Typography preview */}
      <AnimatePresence>
        {font.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Type className="w-4 h-4 text-blue-500" />
                  <h4 className="text-sm font-semibold text-bolt-elements-textPrimary">Typography Preview</h4>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="text-lg font-semibold text-bolt-elements-textPrimary" style={{ fontFamily: font[0] }}>
                    Heading Text
                  </div>
                  <div
                    className="text-sm text-bolt-elements-textSecondary leading-relaxed"
                    style={{ fontFamily: font[0] }}
                  >
                    This is how your body text will appear with the selected typography.
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );

  const renderFeaturesSection = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-green-500/10">
          <Wand2 className="w-4 h-4 text-green-500" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-bolt-elements-textPrimary">Design Features</h3>
          <p className="text-xs text-bolt-elements-textSecondary">Enable visual enhancements</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-h-80 overflow-y-auto scrollbar-thin scrollbar-thumb-bolt-elements-bg-depth-3">
        {designFeatures.map((f, index) => {
          const isSelected = features.includes(f.key);

          return (
            <motion.div
              key={f.key}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card
                className={classNames(
                  'group cursor-pointer transition-all duration-200 hover:shadow-md h-full',
                  isSelected
                    ? 'ring-2 ring-purple-500/30 border-purple-500/60 bg-purple-500/5'
                    : 'hover:border-purple-500/30',
                )}
                onClick={() => handleFeatureToggle(f.key)}
              >
                <CardContent className="p-4 flex flex-col items-center gap-3 text-center">
                  {/* Icon container */}
                  <div className="relative flex items-center justify-center w-12 h-12 rounded-lg bg-bolt-elements-background-depth-3 transition-all duration-200 group-hover:scale-105">
                    {f.key === 'rounded' && (
                      <div
                        className={classNames(
                          'w-6 h-6 bg-current transition-all duration-200',
                          isSelected ? 'rounded-full opacity-100' : 'rounded opacity-70',
                        )}
                      />
                    )}
                    {f.key === 'border' && (
                      <div
                        className={classNames(
                          'w-6 h-6 rounded transition-all duration-200',
                          isSelected ? 'border-3 border-current opacity-100' : 'border-2 border-current opacity-70',
                        )}
                      />
                    )}
                    {f.key === 'gradient' && (
                      <div className="w-6 h-6 rounded bg-gradient-to-br from-purple-400 via-pink-400 to-indigo-400 opacity-90" />
                    )}
                    {f.key === 'shadow' && (
                      <div className="relative">
                        <div
                          className={classNames(
                            'w-6 h-6 bg-current rounded transition-all duration-200',
                            isSelected ? 'opacity-100' : 'opacity-70',
                          )}
                        />
                        <div
                          className={classNames(
                            'absolute top-1 left-1 w-6 h-6 bg-current rounded transition-all duration-200',
                            isSelected ? 'opacity-50' : 'opacity-40',
                          )}
                        />
                      </div>
                    )}
                    {f.key === 'frosted-glass' && (
                      <div className="relative">
                        <div
                          className={classNames(
                            'w-6 h-6 rounded transition-all duration-200 backdrop-blur-sm bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor',
                            isSelected ? 'opacity-100' : 'opacity-70',
                          )}
                        />
                        <div
                          className={classNames(
                            'absolute inset-0 w-6 h-6 rounded transition-all duration-200 backdrop-blur-md bg-gradient-to-br from-bolt-elements-background-depth-1 to-transparent',
                            isSelected ? 'opacity-70' : 'opacity-50',
                          )}
                        />
                      </div>
                    )}

                    {/* Selection indicator */}
                    {isSelected && (
                      <div className="absolute -top-1 -right-1 w-4 h-4 bg-purple-500 rounded-full flex items-center justify-center shadow-sm">
                        <Check className="text-white text-xs" />
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="space-y-1">
                    <h4
                      className={classNames(
                        'text-sm font-semibold transition-colors',
                        isSelected ? 'text-purple-500' : 'text-bolt-elements-textPrimary',
                      )}
                    >
                      {f.label}
                    </h4>

                    <Badge variant="subtle" size="sm" className="text-xs">
                      {f.key === 'rounded' && 'Soft appearance'}
                      {f.key === 'border' && 'Clean lines'}
                      {f.key === 'gradient' && 'Colorful appeal'}
                      {f.key === 'shadow' && 'Depth effect'}
                      {f.key === 'frosted-glass' && 'Glassmorphism'}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Active features summary */}
      <AnimatePresence>
        {features.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Wand2 className="w-4 h-4 text-green-500" />
                  <h4 className="text-sm font-semibold text-bolt-elements-textPrimary">Active Features</h4>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {features.map((featureKey) => {
                    const feature = designFeatures.find((f) => f.key === featureKey);
                    return (
                      <Badge key={featureKey} variant="primary" size="sm" className="text-xs">
                        {feature?.label}
                        <motion.button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleFeatureToggle(featureKey);
                          }}
                          className="ml-1 hover:bg-purple-600/20 rounded p-0.5"
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                        >
                          <X className="w-2.5 h-2.5" />
                        </motion.button>
                      </Badge>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );

  return (
    <div>
      <IconButton
        title="Design Palette & Features"
        className="transition-all hover:scale-105 text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary"
        onClick={() => setIsDialogOpen(!isDialogOpen)}
        icon={Palette}
      />

      <DialogRoot open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <Dialog>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2 }}
          >
            <Card className="min-w-[540px] max-w-[90vw] max-h-[85vh] flex flex-col gap-6 overflow-hidden">
              {/* Enhanced Header */}
              <CardHeader>
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                    <Palette className="text-white w-5 h-5" />
                  </div>
                  <div>
                    <DialogTitle className="text-2xl font-bold text-bolt-elements-textPrimary">
                      Design System
                    </DialogTitle>
                    <DialogDescription className="text-sm text-bolt-elements-textSecondary leading-relaxed">
                      Customize colors, typography, and features for your design system.
                    </DialogDescription>
                  </div>
                </div>
              </CardHeader>

              {/* Enhanced Navigation Tabs */}
              <div className="px-6">
                <div className="flex gap-1 p-1 bg-bolt-elements-background-depth-3 rounded-xl">
                  {[
                    { key: 'colors', label: 'Colors', icon: Palette, count: Object.keys(palette).length },
                    { key: 'typography', label: 'Typography', icon: Type, count: font.length },
                    { key: 'features', label: 'Features', icon: Wand2, count: features.length },
                  ].map((tab) => (
                    <motion.button
                      key={tab.key}
                      onClick={() => setActiveSection(tab.key as any)}
                      className={classNames(
                        'flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-purple-500/50',
                        activeSection === tab.key
                          ? 'bg-purple-500/20 text-purple-600 shadow-md'
                          : 'bg-transparent text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-background-depth-2',
                      )}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <tab.icon className="w-4 h-4" />
                      <span className="text-sm">{tab.label}</span>
                      <Badge
                        variant={activeSection === tab.key ? 'primary' : 'subtle'}
                        size="sm"
                        className="text-xs min-w-[1.25rem] h-5 flex items-center justify-center"
                      >
                        {tab.count}
                      </Badge>
                    </motion.button>
                  ))}
                </div>
              </div>

              {/* Enhanced Content Area */}
              <div className="flex-1 min-h-0 overflow-y-auto px-6">
                <AnimatePresence mode="wait">
                  {activeSection === 'colors' && (
                    <motion.div
                      key="colors"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.2 }}
                    >
                      {renderColorSection()}
                    </motion.div>
                  )}
                  {activeSection === 'typography' && (
                    <motion.div
                      key="typography"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.2 }}
                    >
                      {renderTypographySection()}
                    </motion.div>
                  )}
                  {activeSection === 'features' && (
                    <motion.div
                      key="features"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.2 }}
                    >
                      {renderFeaturesSection()}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Enhanced Action Buttons */}
              <div className="px-6 pb-6">
                <div className="flex justify-between items-center pt-4 border-t border-bolt-elements-borderColor/30">
                  <div className="flex items-center gap-3 text-xs text-bolt-elements-textSecondary">
                    <Badge variant="subtle" size="sm">
                      {Object.keys(palette).length} colors
                    </Badge>
                    <Badge variant="subtle" size="sm">
                      {font.length} fonts
                    </Badge>
                    <Badge variant="subtle" size="sm">
                      {features.length} features
                    </Badge>
                  </div>
                  <div className="flex gap-3">
                    <Button variant="secondary" onClick={() => setIsDialogOpen(false)} className="px-4 py-2 text-sm">
                      Cancel
                    </Button>
                    <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                      <Button
                        onClick={handleSave}
                        className="px-4 py-2 bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white font-medium shadow-lg hover:shadow-xl transition-all duration-200"
                      >
                        <Sparkles className="w-3 h-3 mr-2" />
                        Apply Changes
                      </Button>
                    </motion.div>
                  </div>
                </div>
              </div>
            </Card>
          </motion.div>
        </Dialog>
      </DialogRoot>
    </div>
  );
};
