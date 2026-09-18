import { useEffect, useState } from 'react';
import { Icon } from './Icon.jsx';
import { answerSource } from '../lib/demo-client.js';
import { formatDate } from '../lib/format.js';
import { REPO_URL } from '../lib/links.js';
import { isLive } from '../lib/mode.js';

/**
 * Says where this page's answers came from. On the deployed site that is always a recording, with the
 * model version and the day it was captured; with a key and the local server it says live instead.
 */
export function DataBanner({ demo }) {
  const [source, setSource] = useState(null);

  useEffect(() => {
    let cancelled = false;
    answerSource(demo).then((value) => !cancelled && setSource(value));
    return () => {
      cancelled = true;
    };
  }, [demo.id]);

  if (!source) return <p className="data-banner" aria-busy="true" />;

  return (
    <p className="data-banner">
      <Icon name={isLive ? 'bolt' : 'check'} size={16} />
      {source.live ? (
        <span>
          <strong>Live mode.</strong> Runs on this page call the TypeSafe API with your key, and each one costs a request.
        </span>
      ) : (
        <span>
          <strong>Recorded answers</strong>
          {source.model ? ` · model ${source.model}` : ''}
          {source.recordedAt ? ` · captured ${formatDate(source.recordedAt)}` : ''}. Nothing is sent from this page.{' '}
          <a href={REPO_URL} target="_blank" rel="noreferrer">
            Run it yourself
          </a>
          .
        </span>
      )}
    </p>
  );
}
