const RoomPage = ({
  params,
}: {
  params: {
    id: string;
  };
}) => {
  return <div>Room {params.id}</div>;
};

export default RoomPage;
