interface GameBannerProps {
  bannerUrl: string;
}

export function GameBanner({ bannerUrl }: GameBannerProps) {
  return (
    <div className="w-full h-[80px] md:h-[120px] overflow-hidden md:rounded-t-lg">
      <img
        src={bannerUrl}
        alt="Game banner"
        className="w-full h-full object-cover"
        onError={(e) => {
          const img = e.target as HTMLImageElement;
          if (img.parentElement) img.parentElement.style.display = 'none';
        }}
      />
    </div>
  );
}
