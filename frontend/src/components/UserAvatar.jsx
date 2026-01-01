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

  // Calculate dynamic font size based on content length and avatar size (sx.width)
  const calculateFontSize = () => {
    // If sx.fontSize is explicitly provided, use it
    if (sx.fontSize) return sx.fontSize;
    
    const size = parseInt(sx.width || 40);
    const textLen = avatarContent.length;
    
    if (!hasShortName) return undefined; // Let MUI handle single char default
    
    // Base scaling: 
    // - For standard 40px: 1 char -> 1.2rem, 2 chars -> 1.0rem, 3 chars -> 0.8rem, 4+ chars -> 0.65rem
    // - We adjust this proportionally if 'size' is different from 40
    const ratio = size / 40;
    
    if (textLen <= 1) return `${1.2 * ratio}rem`;
    if (textLen === 2) return `${1.0 * ratio}rem`;
    if (textLen === 3) return `${0.8 * ratio}rem`;
    return `${0.65 * ratio}rem`;
  };

  const avatar = (
    <Avatar
      src={src}
      sx={{
        bgcolor: backgroundColor,
        color: textColor,
        fontSize: calculateFontSize(),
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
