type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
primary?: boolean;
};

export function ActionButton({ primary, className, ...props }: Props) {
return <button className={`button ${primary ? "primary" : ""} ${className ?? ""}`} {...props} />;
}
