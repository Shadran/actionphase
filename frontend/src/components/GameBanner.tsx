interface GameBannerProps {
  bannerUrl: string;
}

export function GameBanner({ bannerUrl }: GameBannerProps) {
  return (
    <div className="w-full overflow-hidden md:rounded-t-lg" style={{ aspectRatio: '6/1' }}>
      <img
        src={bannerUrl}
        alt="Game banner"
        className="w-full h-full object-cover"
        fetchPriority="high"
        onError={(e) => {
          const img = e.target as HTMLImageElement;
          if (img.parentElement) img.parentElement.style.display = 'none';
        }}
      />
    </div>
  );
}
