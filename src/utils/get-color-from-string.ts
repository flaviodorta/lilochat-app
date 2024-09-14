export const getColorFromString = (str: string) => {
  const colors = [
    'text-red-600',
    'text-blue-600',
    'text-green-600',
    'text-yellow-600',
    'text-purple-600',
    'text-pink-600',
    'text-indigo-600',
    'text-teal-600',
    'text-orange-600',
    'text-rose-600',
    'text-violet-600',
    'text-lime-600',
    'text-amber-600',
    'text-emerald-600',
    'text-cyan-600',
    'text-sky-600',
    'text-fuchsia-600',
  ];
  // @ts-ignore
  const hash = [...str].reduce((acc, char) => acc + char.charCodeAt(0), 0);

  const colorIndex = hash % colors.length;

  return colors[colorIndex];
};
