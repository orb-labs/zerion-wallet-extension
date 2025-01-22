import { useFetchDappIcon } from './useFetchDappIcon';

type IconRenderer = (src: string | null) => JSX.Element;

interface Props {
  url: string;
  render: IconRenderer;
}

export function DappIconFetcher({ url: dappUrl, render }: Props) {
  const { data: iconUrl, isPending } = useFetchDappIcon(dappUrl);
  if (isPending) {
    return render(null);
  }
  const src = iconUrl || `${dappUrl}/favicon.png`;
  return render(src);
}
