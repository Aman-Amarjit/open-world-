interface Props {
  onStart: () => void;
}

export function TitleOverlay({ onStart }: Props) {
  return (
    <div className="title-overlay" data-testid="title-overlay">
      <div className="title-card">
        <div className="title-rating">M • MATURE</div>
        <h1 className="title-name">SOUTH ISLAND CITY</h1>
        <p className="title-tag">A top-down crime drive across a procedural metropolis</p>
        <div className="title-controls">
          <div><kbd>WASD</kbd> / <kbd>↑↓←→</kbd> move &amp; drive</div>
          <div><kbd>E</kbd> enter / exit / carjack</div>
          <div><kbd>Space</kbd> or <kbd>Click</kbd> fire weapon</div>
          <div><kbd>Shift</kbd> handbrake</div>
          <div><kbd>Shift</kbd> sprint (on foot)</div>
          <div><kbd>P</kbd> / <kbd>Esc</kbd> pause</div>
        </div>
        <button
          className="title-start"
          onClick={onStart}
          data-testid="button-start"
        >
          ENTER THE CITY
        </button>
        <p className="title-foot">
          Developed by <strong>Aman Amarjit</strong><br/>
          No injuries are real. Drive responsibly in real life.
        </p>
      </div>
    </div>
  );
}
