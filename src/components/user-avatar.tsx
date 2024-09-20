import { Image } from '@chakra-ui/react';

const UserAvatar = ({
  nickname,
  width,
  height,
}: {
  nickname: string;
  width: number;
  height: number;
}) => {
  return (
    <Image
      src={`https://api.multiavatar.com/${nickname}.png?apikey=${process.env.NEXT_PUBLIC_AVATAR_API_URL}`}
      width={width + 'px'}
      height={height + 'px'}
      alt='Avatar'
      className='rounded-full'
    />
  );
};

export default UserAvatar;
