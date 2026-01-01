import Avatar from '@mui/material/Avatar';
import Tooltip from '@mui/material/Tooltip';

// Helper to determine text color (black/white) based on background color
const getContrastTextColor = (hexColor) => {
  if (!hexColor) return '#fff';
  
  // Convert hex to RGB
  const r = parseInt(hexColor.substr(1, 2), 16);
  const g = parseInt(hexColor.substr(3, 2), 16);
  const b = parseInt(hexColor.substr(5, 2), 16);
  
  // Calculate luminance
  const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
  
  return (yiq >= 128) ? '#000' : '#fff';
};

export default function UserAvatar({ user, showTooltip = true, sx = {}, ...props }) {
  if (!user) return null;

  const backgroundColor = user.color || undefined;
  const textColor = backgroundColor ? getContrastTextColor(backgroundColor) : undefined;
  
  // If shortName is defined, we use it and ignore the picture
  const hasShortName = Boolean(user.shortName);
  const src = hasShortName ? null : user.picture;
  const avatarContent = user.shortName || user.name?.[0]?.toUpperCase() || '?';

  const avatar = (
    <Avatar
      src={src}
      sx={{
        bgcolor: backgroundColor,
        color: textColor,
        fontSize: hasShortName ? '0.75rem' : undefined,
        fontWeight: hasShortName ? 'bold' : undefined,
        ...sx
      }}
      {...props}
    >
      {avatarContent}
    </Avatar>
  );

  if (showTooltip) {
    return (
      <Tooltip title={user.name || 'Usuario'}>
        {avatar}
      </Tooltip>
    );
  }

  return avatar;
}
