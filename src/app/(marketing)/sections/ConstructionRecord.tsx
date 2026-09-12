/** A fictional drawing/programme fragment, never presented as a client record. */
export function ConstructionRecord() {
  return (
    <figure className="construction-record">
      <div className="construction-record-heading">
        <span>Reading the project record</span>
        <span>Illustration</span>
      </div>
      <div className="construction-record-drawing">
        <svg
          viewBox="0 0 600 305"
          role="img"
          aria-labelledby="record-title record-description"
        >
          <title id="record-title">
            A construction sequence and its supporting records
          </title>
          <desc id="record-description">
            Illustrative building section showing structure, envelope and
            access. Programme bars below connect the planned sequence to an
            instruction, site record and cost record. This is not a real project
            or result.
          </desc>
          <g
            className="record-drawing-guide"
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
          >
            <path
              d="M45 48H555M45 111H555M45 175H555M45 238H555M95 25V265M220 25V265M345 25V265M470 25V265"
              strokeDasharray="3 5"
            />
            <path d="M52 270H548M53 263V277M548 263V277" />
          </g>
          <g
            className="record-drawing-structure"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M95 236V49H472V236M218 49V236M344 49V236M94 111H472M94 175H472M75 239H490M70 246H495M77 254H103M208 254H230M333 254H355M460 254H482" />
            <path
              d="M93 111l124-62M220 175l123-64M347 237l124-62"
              strokeWidth="1"
            />
          </g>
          <path d="M473 49v190h14V49z" className="record-drawing-envelope" />
          <path
            d="M490 58h29v160h-29M496 94h24M496 142h24M496 190h24"
            className="record-drawing-annotation"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <g className="record-drawing-labels" fill="currentColor">
            <text x="50" y="295">
              Section through the works
            </text>
            <text x="407" y="295">
              Sequence / access
            </text>
            <text x="111" y="94">
              Structure
            </text>
            <text x="350" y="157">
              Envelope
            </text>
          </g>
          <circle
            cx="480"
            cy="174"
            r="23"
            className="record-drawing-annotation"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          />
        </svg>
      </div>
      <div
        className="record-programme"
        aria-label="Illustrative programme sequence"
      >
        <div className="record-programme-row">
          <span>Structure</span>
          <span className="record-track">
            <i className="record-bar record-bar-structure" />
          </span>
        </div>
        <div className="record-programme-row">
          <span>Envelope</span>
          <span className="record-track">
            <i className="record-bar record-bar-envelope" />
          </span>
        </div>
        <div className="record-programme-row">
          <span>Completion</span>
          <span className="record-track">
            <i className="record-bar record-bar-completion" />
          </span>
        </div>
      </div>
      <div className="record-evidence">
        <p>Test the sequence against the evidence.</p>
        <ul>
          <li>Instruction</li>
          <li>Site record</li>
          <li>Cost record</li>
        </ul>
      </div>
      <figcaption>
        Illustrative records only. No client project or outcome is represented.
      </figcaption>
    </figure>
  );
}
