export default function Button({
  as: Component = 'button',
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  className = '',
  type,
  children,
  ...rest
}) {
  const isNativeButton = Component === 'button';
  const classes = [
    'button',
    `button--${variant}`,
    `button--${size}`,
    fullWidth ? 'button--full' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <Component
      className={classes}
      {...(isNativeButton ? { type: type || 'button' } : {})}
      {...rest}
    >
      {children}
    </Component>
  );
}
