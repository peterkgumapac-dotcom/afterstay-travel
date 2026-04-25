import React, { useCallback, useRef, useState } from 'react';
import { Image, ImageStyle, StyleProp } from 'react-native';

interface CachedImageProps {
  remoteUrl: string;
  style?: StyleProp<ImageStyle>;
  resizeMode?: 'cover' | 'contain' | 'stretch' | 'center';
}

function CachedImageInner({ remoteUrl, style, resizeMode = 'cover' }: CachedImageProps) {
  const [uri, setUri] = useState(remoteUrl);
  const retried = useRef(false);

  const handleError = useCallback(() => {
    if (!retried.current) {
      retried.current = true;
      setUri(remoteUrl + (remoteUrl.includes('?') ? '&' : '?') + `_r=${Date.now()}`);
    }
  }, [remoteUrl]);

  return (
    <Image
      source={{ uri }}
      style={style}
      resizeMode={resizeMode}
      onError={handleError}
      fadeDuration={150}
    />
  );
}

export const CachedImage = React.memo(CachedImageInner);
