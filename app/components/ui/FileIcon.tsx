import React from 'react';
import { classNames } from '~/utils/classNames';
import {
  FileCode,
  FileText,
  Braces,
  File,
  FileVideo,
  FileAudio,
  FileImage,
  FileArchive,
  Package,
  BookOpen,
  Scale,
  GitBranch,
  Lock,
  FileSpreadsheet,
  Presentation,
} from 'lucide-react';

interface FileIconProps {
  filename: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function FileIcon({ filename, size = 'md', className }: FileIconProps) {
  const getFileExtension = (filename: string): string => {
    return filename.split('.').pop()?.toLowerCase() || '';
  };

  const getIconForExtension = (extension: string): React.ComponentType<{ className?: string }> => {
    // Code files
    if (['js', 'jsx', 'ts', 'tsx'].includes(extension)) {
      return FileCode;
    }

    if (['html', 'htm', 'xhtml'].includes(extension)) {
      return FileCode;
    }

    if (['css', 'scss', 'sass', 'less'].includes(extension)) {
      return FileCode;
    }

    if (['json', 'jsonc'].includes(extension)) {
      return Braces;
    }

    if (['md', 'markdown'].includes(extension)) {
      return FileText;
    }

    if (['py', 'pyc', 'pyd', 'pyo'].includes(extension)) {
      return FileCode;
    }

    if (['java', 'class', 'jar'].includes(extension)) {
      return FileCode;
    }

    if (['php'].includes(extension)) {
      return FileCode;
    }

    if (['rb', 'ruby'].includes(extension)) {
      return File;
    }

    if (['c', 'cpp', 'h', 'hpp', 'cc'].includes(extension)) {
      return FileCode;
    }

    if (['go'].includes(extension)) {
      return File;
    }

    if (['rs', 'rust'].includes(extension)) {
      return File;
    }

    if (['swift'].includes(extension)) {
      return FileCode;
    }

    if (['kt', 'kotlin'].includes(extension)) {
      return FileCode;
    }

    if (['dart'].includes(extension)) {
      return FileCode;
    }

    // Config files
    if (['yml', 'yaml'].includes(extension)) {
      return FileCode;
    }

    if (['xml', 'svg'].includes(extension)) {
      return FileCode;
    }

    if (['toml'].includes(extension)) {
      return FileText;
    }

    if (['ini', 'conf', 'config'].includes(extension)) {
      return FileText;
    }

    if (['env', 'env.local', 'env.development', 'env.production'].includes(extension)) {
      return Lock;
    }

    // Document files
    if (['pdf'].includes(extension)) {
      return File;
    }

    if (['doc', 'docx'].includes(extension)) {
      return FileText;
    }

    if (['xls', 'xlsx'].includes(extension)) {
      return FileSpreadsheet;
    }

    if (['ppt', 'pptx'].includes(extension)) {
      return Presentation;
    }

    if (['txt'].includes(extension)) {
      return FileText;
    }

    // Image files
    if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'ico', 'tiff'].includes(extension)) {
      return FileImage;
    }

    // Audio/Video files
    if (['mp3', 'wav', 'ogg', 'flac', 'aac'].includes(extension)) {
      return FileAudio;
    }

    if (['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm', 'mkv'].includes(extension)) {
      return FileVideo;
    }

    // Archive files
    if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2'].includes(extension)) {
      return FileArchive;
    }

    // Special files
    if (filename === 'package.json') {
      return Package;
    }

    if (filename === 'tsconfig.json') {
      return FileCode;
    }

    if (filename === 'README.md') {
      return BookOpen;
    }

    if (filename === 'LICENSE') {
      return Scale;
    }

    if (filename === '.gitignore') {
      return GitBranch;
    }

    if (filename.startsWith('Dockerfile')) {
      return FileCode;
    }

    // Default
    return File;
  };

  const getIconColorForExtension = (extension: string): string => {
    // Code files
    if (['js', 'jsx'].includes(extension)) {
      return 'text-yellow-500';
    }

    if (['ts', 'tsx'].includes(extension)) {
      return 'text-blue-500';
    }

    if (['html', 'htm', 'xhtml'].includes(extension)) {
      return 'text-orange-500';
    }

    if (['css', 'scss', 'sass', 'less'].includes(extension)) {
      return 'text-blue-400';
    }

    if (['json', 'jsonc'].includes(extension)) {
      return 'text-yellow-400';
    }

    if (['md', 'markdown'].includes(extension)) {
      return 'text-gray-500';
    }

    if (['py', 'pyc', 'pyd', 'pyo'].includes(extension)) {
      return 'text-green-500';
    }

    if (['java', 'class', 'jar'].includes(extension)) {
      return 'text-red-500';
    }

    if (['php'].includes(extension)) {
      return 'text-purple-500';
    }

    if (['rb', 'ruby'].includes(extension)) {
      return 'text-red-600';
    }

    if (['c', 'cpp', 'h', 'hpp', 'cc'].includes(extension)) {
      return 'text-blue-600';
    }

    if (['go'].includes(extension)) {
      return 'text-cyan-500';
    }

    if (['rs', 'rust'].includes(extension)) {
      return 'text-orange-600';
    }

    if (['swift'].includes(extension)) {
      return 'text-orange-500';
    }

    if (['kt', 'kotlin'].includes(extension)) {
      return 'text-purple-400';
    }

    if (['dart'].includes(extension)) {
      return 'text-cyan-400';
    }

    // Config files
    if (['yml', 'yaml'].includes(extension)) {
      return 'text-purple-300';
    }

    if (['xml'].includes(extension)) {
      return 'text-orange-300';
    }

    if (['svg'].includes(extension)) {
      return 'text-green-400';
    }

    if (['toml'].includes(extension)) {
      return 'text-gray-500';
    }

    if (['ini', 'conf', 'config'].includes(extension)) {
      return 'text-gray-500';
    }

    if (['env', 'env.local', 'env.development', 'env.production'].includes(extension)) {
      return 'text-green-500';
    }

    // Document files
    if (['pdf'].includes(extension)) {
      return 'text-red-500';
    }

    if (['doc', 'docx'].includes(extension)) {
      return 'text-blue-600';
    }

    if (['xls', 'xlsx'].includes(extension)) {
      return 'text-green-600';
    }

    if (['ppt', 'pptx'].includes(extension)) {
      return 'text-red-600';
    }

    if (['txt'].includes(extension)) {
      return 'text-gray-500';
    }

    // Image files
    if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'ico', 'tiff'].includes(extension)) {
      return 'text-pink-500';
    }

    // Audio/Video files
    if (['mp3', 'wav', 'ogg', 'flac', 'aac'].includes(extension)) {
      return 'text-green-500';
    }

    if (['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm', 'mkv'].includes(extension)) {
      return 'text-blue-500';
    }

    // Archive files
    if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2'].includes(extension)) {
      return 'text-yellow-600';
    }

    // Special files
    if (filename === 'package.json') {
      return 'text-red-400';
    }

    if (filename === 'tsconfig.json') {
      return 'text-blue-500';
    }

    if (filename === 'README.md') {
      return 'text-blue-400';
    }

    if (filename === 'LICENSE') {
      return 'text-gray-500';
    }

    if (filename === '.gitignore') {
      return 'text-orange-500';
    }

    if (filename.startsWith('Dockerfile')) {
      return 'text-blue-500';
    }

    // Default
    return 'text-gray-400';
  };

  const getSizeClass = (size: 'sm' | 'md' | 'lg'): string => {
    switch (size) {
      case 'sm':
        return 'w-4 h-4';
      case 'md':
        return 'w-5 h-5';
      case 'lg':
        return 'w-6 h-6';
      default:
        return 'w-5 h-5';
    }
  };

  const extension = getFileExtension(filename);
  const icon = getIconForExtension(extension);
  const color = getIconColorForExtension(extension);
  const sizeClass = getSizeClass(size);

  const IconComponent = icon;

  return <IconComponent className={classNames(color, sizeClass, className)} />;
}
