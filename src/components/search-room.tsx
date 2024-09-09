'use client';

const SearchRoom = () => {
  return (
    <form className='max-w-lg w-full'>
      <label
        htmlFor='search-room'
        className='mb-2 text-sm font-medium text-gray-900 sr-only dark:text-white'
      >
        Search Room
      </label>
      <div className='relative'>
        <div className='absolute inset-y-0 start-0 flex items-center ps-3 pointer-events-none'>
          <svg
            className='w-4 h-4 text-gray-500 dark:text-gray-400'
            aria-hidden='true'
            xmlns='http://www.w3.org/2000/svg'
            fill='none'
            viewBox='0 0 20 20'
          >
            <path
              stroke='currentColor'
              strokeLinecap='round'
              strokeLinejoin='round'
              strokeWidth='2'
              d='m19 19-4-4m0-7A7 7 0 1 1 1 8a7 7 0 0 1 14 0Z'
            />
          </svg>
        </div>
        <input
          type='search'
          id='search-room'
          className='outline-none block w-full px-4 py-2.5 ps-10 text-sm text-gray-900 border border-gray-300 rounded-lg bg-gray-50 focus:ring-purple-500 focus:border-purple-500 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-purple-500 dark:focus:border-purple-500'
          placeholder='#ladygaga #meme #vinheiteiro...'
          required
        />
      </div>
    </form>
  );
};

export default SearchRoom;
