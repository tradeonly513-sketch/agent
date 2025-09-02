import { IconButton } from '~/components/ui/IconButton';
import { classNames } from '~/utils/classNames';
import React from 'react';
import { Mic, MicOff } from 'lucide-react';

export const SpeechRecognitionButton = ({
  isListening,
  onStart,
  onStop,
  disabled,
}: {
  isListening: boolean;
  onStart: () => void;
  onStop: () => void;
  disabled: boolean;
}) => {
  return (
    <IconButton
      title={isListening ? 'Stop listening' : 'Start speech recognition'}
      disabled={disabled}
      className={classNames('transition-all', {
        'text-bolt-elements-item-contentAccent': isListening,
      })}
      onClick={isListening ? onStop : onStart}
    >
      {isListening ? <MicOff className="text-lg" /> : <Mic className="text-lg" />}
    </IconButton>
  );
};
