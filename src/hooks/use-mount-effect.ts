import { useEffect, useState } from 'react';

export const useMountEffect = () => {
  const [isMount, setIsMount] = useState(false);

  useEffect(() => {
    if (!isMount) setIsMount(true);
  }, []);

  return isMount;
};
