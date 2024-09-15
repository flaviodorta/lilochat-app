import { useEffect } from 'react';

const FirstKeyPress = () => {
  useEffect(() => {
    const handleFirstKeyPress = (event: KeyboardEvent) => {
      if (!textareaRef.current) return;

      if (event.key.length === 1) {
        textareaRef.current.focus();
        setNewMessage((prev) => prev + event.key);
      }
    };

    window.addEventListener('keydown', handleFirstKeyPress);

    return () => {
      window.removeEventListener('keydown', handleFirstKeyPress);
    };
  }, []);
};
