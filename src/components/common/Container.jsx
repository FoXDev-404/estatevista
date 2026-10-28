export default function Container({ as: Tag = 'div', size = 'default', className = '', children, ...rest }) {
  const sizeClass = size === 'wide' ? ' container--wide' : size === 'narrow' ? ' container--narrow' : '';
  return (
    <Tag className={`container${sizeClass}${className ? ` ${className}` : ''}`} {...rest}>
      {children}
    </Tag>
  );
}
