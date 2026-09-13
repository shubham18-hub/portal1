import React from "react";
import { Star } from "lucide-react";

const StarRating = ({ value = 0, onChange, testId }) => {
    return (
        <div className="flex gap-1.5" data-testid={testId}>
            {[1, 2, 3, 4, 5].map((n) => (
                <button
                    key={n}
                    type="button"
                    onClick={() => onChange?.(n)}
                    className={`star-btn ${n <= value ? "active" : ""}`}
                    data-testid={`${testId}-${n}`}
                    aria-label={`${n} star`}
                >
                    <Star
                        size={20}
                        strokeWidth={1.6}
                        fill={n <= value ? "#0055FF" : "none"}
                    />
                </button>
            ))}
        </div>
    );
};

export default StarRating;
