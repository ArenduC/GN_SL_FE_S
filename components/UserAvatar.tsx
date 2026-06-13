import React from 'react';
import { User } from '../types';

interface UserAvatarProps {
  user?: User | null;
  className?: string;
  title?: string;
  isOnline?: boolean;
}

const colors = [
  'bg-[#A56F5A]', // Muted Terracotta
  'bg-[#5A8DA5]', // Muted Slate Blue
  'bg-[#5AA58A]', // Muted Teal
  'bg-[#A5A05A]', // Muted Gold/Green
  'bg-[#8A5AA5]', // Muted Plum
  'bg-[#A55A73]', // Muted Rose
];

const getColor = (name: string): string => {
  const charCodeSum = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[charCodeSum % colors.length];
};

export const UserAvatar: React.FC<UserAvatarProps> = ({ user, className, title, isOnline = false }) => {
  const [imgError, setImgError] = React.useState(false);

  if (!user) {
    return (
      <div
        className={`flex items-center justify-center rounded-full bg-gray-700 text-white font-bold ${className}`}
        title={title || "Unassigned"}
      >
        ?
      </div>
    );
  }

  const initial = user.name ? user.name.charAt(0).toUpperCase() : '?';
  const color = getColor(user.name);
  const avatar = user.avatarUrl || (user as any).avatar_url;
  const showImage = avatar && !imgError;
  
  return (
    <div
      className={`relative flex-shrink-0 flex items-center justify-center ${className}`}
      title={title || user.name}
    >
      <div className={`w-full h-full flex items-center justify-center rounded-full overflow-hidden text-white font-bold ${showImage ? '' : color}`}>
        {showImage ? (
          <img 
            src={avatar} 
            alt={user.name} 
            onError={() => setImgError(true)}
            className="w-full h-full object-cover rounded-full"
            referrerPolicy="no-referrer"
          />
        ) : (
          initial
        )}
      </div>
      {isOnline && (
        <span className="absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full bg-green-500 ring-2 ring-[#131C1B]" title="Online"></span>
      )}
    </div>
  );
};