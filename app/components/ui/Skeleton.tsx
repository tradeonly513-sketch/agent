import { classNames } from '~/utils/classNames';

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={classNames('animate-pulse rounded-md bg-bolt-elements-background-depth-2', className)} {...props} />
  );
}

export { Skeleton };
