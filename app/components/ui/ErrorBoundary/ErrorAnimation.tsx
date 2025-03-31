import React from 'react';
import Lottie from 'react-lottie-player';

import data from '~/assets/animations/error.json';

const defaultOptions = {
  loop: true,
  play: true,
  animationData: data,
  rendererSettings: {
    preserveAspectRatio: 'xMidYMid slice',
  },
  style: { width: '200px' },
};

const ErrorAnimation: React.FC = () => {
  return <Lottie {...defaultOptions} />;
};

export default ErrorAnimation;
