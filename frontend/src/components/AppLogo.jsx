import SvgIcon from '@mui/material/SvgIcon';

export default function AppLogo(props) {
  const colors = {
    bg: '#1565C0',   // Deep Blue
    inner: '#90CAF9', // Lighter Blue
    check: '#1565C0'  // Deep Blue
  };

  return (
    <SvgIcon viewBox="0 0 24 24" {...props}>
      {/* Background: Rounded Square */}
      <rect x="2" y="2" width="20" height="20" rx="5" fill={colors.bg}/>
      
      {/* Inner Box */}
      <rect x="7" y="7" width="10" height="10" rx="1" fill={colors.inner}/>
      
      {/* Checkmark */}
      <path d="M10.5 14.5L8.5 12.5L9.2 11.8L10.5 13.1L14.8 8.8L15.5 9.5L10.5 14.5Z" fill={colors.check} stroke={colors.check} strokeWidth="0.5"/>
    </SvgIcon>
  );
}