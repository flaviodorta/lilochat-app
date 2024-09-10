const LoginButton = ({ onClick }: { onClick: () => void }) => {
  return (
    <>
      <button
        type='button'
        onClick={onClick}
        className='button px-4 py-2.5 flex justify-center bg-neutral-50 hover:bg-purple-600 transition-all duration-75 border-purple-600 border text-purple-600 group'
      >
        {/* <div className='relative bg-gray-50 px-5 py-2.5 transition-all ease-in duration-75  dark:bg-gray-900 rounded-md group-hover:bg-opacity-0'> */}
        Log In
        {/* </div> */}
      </button>
    </>
  );
};

export default LoginButton;
