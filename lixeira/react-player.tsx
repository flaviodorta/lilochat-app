// @ts-nocheck

'use client';

import React, { useState, useRef } from 'react';
import ReactPlayer from 'react-player';

const VideoPlayer = ({ playing, videoTime, onPlay, onPause, onSeek }) => {
  const playerRef = useRef(null);

  // Atualiza o tempo de reprodução conforme o progresso
  const handleProgress = (state) => {
    if (onSeek) {
      onSeek(state.playedSeconds);
    }
  };

  return (
    <ReactPlayer
      ref={playerRef}
      playing={playing}
      controls
      onPlay={onPlay}
      onPause={onPause}
      onProgress={handleProgress}
      url='URL_DO_SEU_VIDEO'
    />
  );
};

export default VideoPlayer;
