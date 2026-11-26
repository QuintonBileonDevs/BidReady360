import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import {
  ZoomIn,
  ZoomOut,
  RotateCw,
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
  AlertCircle,
  RefreshCw,
  FileText,
  Maximize2,
  Layers,
} from 'lucide-react';

// Configure PDF.js worker once using Vite's static asset URL
pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export interface DocumentVaultPreviewProps {
  blob?: Blob | null;
  objectUrl?: string | null;
  fileName?: string;
  mimeType?: string;
  title?: string;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onDownload?: () => void;
  maxHeightClass?: string;
}

type DetectedKind = 'pdf' | 'image' | 'docx' | 'text' | 'unsupported';

const ALLOWED_DOCX_TAGS = new Set([
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'p', 'div', 'span', 'br', 'hr',
  'ul', 'ol', 'li',
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td',
  'strong', 'b', 'em', 'i', 'u', 'sup', 'sub', 'blockquote',
]);

function detectKindFromBytes(
  bytes: Uint8Array,
  mimeType?: string,
  fileName?: string
): DetectedKind {
  const mime = String(mimeType || '').split(';')[0].trim().toLowerCase();
  const ext = (fileName || '').split('.').pop()?.toLowerCase() || '';

  if (bytes.length >= 4) {
    // Check %PDF within first 1024 bytes
    const limit = Math.min(1024, bytes.length - 3);
    for (let i = 0; i <= limit; i++) {
      if (
        bytes[i] === 0x25 &&
        bytes[i + 1] === 0x50 &&
        bytes[i + 2] === 0x44 &&
        bytes[i + 3] === 0x46
      ) {
        return 'pdf';
      }
    }
    // PNG
    if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
      return 'image';
    }
    // JPEG
    if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
      return 'image';
    }
    // GIF
    if (
      bytes.length >= 6 &&
      bytes[0] === 0x47 &&
      bytes[1] === 0x49 &&
      bytes[2] === 0x46 &&
      bytes[3] === 0x38
    ) {
      return 'image';
    }
    // WebP (RIFF....WEBP)
    if (
      bytes.length >= 12 &&
      bytes[0] === 0x52 &&
      bytes[1] === 0x49 &&
      bytes[2] === 0x46 &&
      bytes[3] === 0x46 &&
      bytes[8] === 0x57 &&
      bytes[9] === 0x45 &&
      bytes[10] === 0x42 &&
      bytes[11] === 0x50
    ) {
      return 'image';
    }
    // ZIP container -> DOCX
    if (bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04) {
      if (ext === 'docx' || mime.includes('wordprocessingml')) {
        return 'docx';
      }
    }
  }

  if (mime === 'application/pdf' || ext === 'pdf') return 'pdf';
  if (mime.startsWith('image/') && mime !== 'image/svg+xml') return 'image';
  if (['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext)) return 'image';
  if (mime.includes('wordprocessingml') || ext === 'docx') return 'docx';
  if (mime === 'text/plain' || mime === 'text/csv' || ext === 'txt' || ext === 'csv') return 'text';
  return 'unsupported';
}

/**
 * Safely converts an allowlisted HTML DOM tree (from mammoth DOCX conversion)
 * into pure React elements without ever using dangerouslySetInnerHTML.
 */
function domNodeToReact(node: Node, key: string): React.ReactNode {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent;
  }
  if (node.nodeType !== Node.ELEMENT_NODE) {
    return null;
  }

  const el = node as Element;
  const tag = el.tagName.toLowerCase();

  if (tag === 'script' || tag === 'style' || tag === 'iframe' || tag === 'object' || tag === 'embed') {
    return null;
  }

  const children = Array.from(el.childNodes)
    .map((child, idx) => domNodeToReact(child, `${key}-${idx}`))
    .filter((c) => c !== null && c !== undefined);

  if (!ALLOWED_DOCX_TAGS.has(tag)) {
    return React.createElement(React.Fragment, { key }, ...children);
  }

  const props: Record<string, any> = { key };
  if (tag === 'h1') props.className = 'text-xl font-bold text-slate-900 mt-4 mb-2';
  else if (tag === 'h2') props.className = 'text-lg font-bold text-slate-900 mt-4 mb-2';
  else if (tag === 'h3' || tag === 'h4') props.className = 'text-base font-semibold text-slate-900 mt-3 mb-1.5';
  else if (tag === 'p') props.className = 'text-sm leading-relaxed text-slate-800 my-2';
  else if (tag === 'ul') props.className = 'list-disc pl-6 my-2 space-y-1 text-sm text-slate-800';
  else if (tag === 'ol') props.className = 'list-decimal pl-6 my-2 space-y-1 text-sm text-slate-800';
  else if (tag === 'table') props.className = 'w-full border-collapse border border-slate-300 my-3 text-xs';
  else if (tag === 'th') props.className = 'border border-slate-300 bg-slate-100 px-2.5 py-1.5 text-left font-semibold text-slate-900';
  else if (tag === 'td') props.className = 'border border-slate-300 px-2.5 py-1.5 text-slate-800';
  else if (tag === 'blockquote') props.className = 'border-l-4 border-slate-300 pl-3 italic text-slate-700 my-2';

  if (tag === 'br' || tag === 'hr') {
    return React.createElement(tag, props);
  }

  return React.createElement(tag, props, ...children);
}

export const DocumentVaultPreview: React.FC<DocumentVaultPreviewProps> = ({
  blob,
  objectUrl,
  fileName = 'document',
  mimeType = '',
  isLoading = false,
  error = null,
  onRetry,
  onDownload,
  maxHeightClass = 'h-[480px]',
}) => {
  const [detectedKind, setDetectedKind] = useState<DetectedKind | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [isInspecting, setIsInspecting] = useState<boolean>(false);

  // PDF state (react-pdf)
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [showAllPages, setShowAllPages] = useState<boolean>(false);
  const [zoom, setZoom] = useState<number>(1.0);
  const [rotation, setRotation] = useState<number>(0);
  const [containerWidth, setContainerWidth] = useState<number>(640);
  const pdfViewportRef = useRef<HTMLDivElement | null>(null);

  // DOCX & text state
  const [docxNodes, setDocxNodes] = useState<React.ReactNode[] | null>(null);
  const [plainText, setPlainText] = useState<string | null>(null);

  // Local objectUrl fallback when caller only supplies blob
  const [internalObjectUrl, setInternalObjectUrl] = useState<string | null>(null);
  const activeObjectUrl = objectUrl || internalObjectUrl;

  useEffect(() => {
    if (objectUrl || !blob) {
      setInternalObjectUrl(null);
      return;
    }
    const url = URL.createObjectURL(blob);
    setInternalObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [blob, objectUrl]);

  // Track responsive container width for react-pdf <Page width={...} />
  useEffect(() => {
    const el = pdfViewportRef.current;
    if (!el) return;

    const updateWidth = () => {
      if (!pdfViewportRef.current) return;
      const measured = pdfViewportRef.current.clientWidth;
      if (measured > 0) {
        setContainerWidth(Math.min(820, Math.max(280, measured - 36)));
      }
    };

    updateWidth();
    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(updateWidth);
      observer.observe(el);
      return () => observer.disconnect();
    }
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, [detectedKind, blob]);

  // Sniff bytes & parse non-PDF previews whenever blob changes
  useEffect(() => {
    let cancelled = false;

    setRenderError(null);
    setDocxNodes(null);
    setPlainText(null);
    setNumPages(0);
    setPageNumber(1);
    setShowAllPages(false);
    setZoom(1.0);
    setRotation(0);

    if (!blob) {
      setDetectedKind(null);
      setIsInspecting(false);
      return;
    }

    setIsInspecting(true);

    (async () => {
      try {
        const headerSlice = blob.slice(0, 2048);
        const headerBuffer = await headerSlice.arrayBuffer();
        if (cancelled) return;

        if (blob.size === 0) {
          setDetectedKind('unsupported');
          setRenderError('The stored document file is empty (0 bytes).');
          setIsInspecting(false);
          return;
        }

        const headerBytes = new Uint8Array(headerBuffer);
        const kind = detectKindFromBytes(headerBytes, mimeType || blob.type, fileName);
        setDetectedKind(kind);

        if (kind === 'docx') {
          const fullBuffer = await blob.arrayBuffer();
          if (cancelled) return;
          const mammothMod: any = await import('mammoth');
          const mammoth = mammothMod.default || mammothMod;
          const result = await mammoth.convertToHtml({ arrayBuffer: fullBuffer });
          if (cancelled) return;
          const parser = new DOMParser();
          const parsedDoc = parser.parseFromString(result.value || '', 'text/html');
          const nodes = Array.from(parsedDoc.body.childNodes).map((n, idx) =>
            domNodeToReact(n, `docx-${idx}`)
          );
          setDocxNodes(nodes);
        } else if (kind === 'text') {
          const text = await blob.text();
          if (cancelled) return;
          setPlainText(text);
        }
      } catch (err: any) {
        if (!cancelled) {
          console.error('[DocumentVaultPreview] Failed to inspect document:', err);
          setRenderError(err?.message || 'Unable to render this document file.');
        }
      } finally {
        if (!cancelled) {
          setIsInspecting(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [blob, mimeType, fileName]);

  const handleDocumentLoadSuccess = useCallback(({ numPages: total }: { numPages: number }) => {
    setNumPages(total);
    setPageNumber((prev) => (prev > total ? 1 : prev));
    setRenderError(null);
  }, []);

  const handleDocumentLoadError = useCallback((err: Error) => {
    console.error('[DocumentVaultPreview] react-pdf failed to load PDF:', err);
    setRenderError(
      err?.message || 'Unable to render PDF contents. You can download the original file below.'
    );
  }, []);

  const handleTriggerDownload = useCallback(() => {
    if (onDownload) {
      onDownload();
      return;
    }
    if (!activeObjectUrl) return;
    const a = document.createElement('a');
    a.href = activeObjectUrl;
    a.download = fileName || 'document';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [onDownload, activeObjectUrl, fileName]);

  if (isLoading || isInspecting) {
    return (
      <div className={`w-full ${maxHeightClass} bg-slate-50 dark:bg-[#0D1B26] flex flex-col items-center justify-center gap-3 p-6 text-center`}>
        <Loader2 className="w-7 h-7 animate-spin text-[#1F5F99] dark:text-[#38BDF8]" />
        <p className="text-[13px] text-[#43525F] dark:text-[#B2C3D2]">
          {isLoading ? 'Loading uploaded document from secure vault...' : 'Preparing document preview...'}
        </p>
      </div>
    );
  }

  if (error || renderError) {
    return (
      <div className="w-full min-h-[240px] bg-slate-50 dark:bg-[#0D1B26] flex flex-col items-center justify-center gap-3 p-6 text-center">
        <AlertCircle className="w-8 h-8 text-amber-500" />
        <div className="space-y-1 max-w-md">
          <p className="font-semibold text-[14px] text-[#10212E] dark:text-white">
            Document preview unavailable
          </p>
          <p className="text-[13px] text-[#6B7A87] dark:text-[#B2C3D2]">
            {error || renderError}
          </p>
        </div>
        <div className="flex items-center gap-2 pt-1">
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="px-3.5 py-1.5 border border-[#D5E0EA] dark:border-[#1E364A] bg-white dark:bg-[#132635] text-[#10212E] dark:text-white rounded-[6px] text-[12px] font-medium inline-flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry</span>
            </button>
          )}
          {activeObjectUrl && (
            <button
              type="button"
              onClick={handleTriggerDownload}
              className="px-3.5 py-1.5 bg-[#1F5F99] hover:bg-[#184c7a] text-white rounded-[6px] text-[12px] font-medium inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download original file</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  if (!blob) {
    return (
      <div className="w-full min-h-[220px] bg-slate-50 dark:bg-[#0D1B26] flex items-center justify-center p-6 text-[13px] text-[#6B7A87]">
        Select a document to preview its contents.
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col bg-slate-100 dark:bg-[#0D1B26]">
      {/* Viewer Controls Bar */}
      <div className="px-3 py-2 bg-white dark:bg-[#132635] border-b border-[#D5E0EA] dark:border-[#1E364A] flex flex-wrap items-center justify-between gap-2 text-[12px]">
        <div className="flex items-center gap-1.5 flex-wrap">
          {detectedKind === 'pdf' && numPages > 0 && (
            <>
              {!showAllPages && (
                <>
                  <button
                    type="button"
                    disabled={pageNumber <= 1}
                    onClick={() => setPageNumber((p) => Math.max(1, p - 1))}
                    className="p-1 rounded border border-[#D5E0EA] dark:border-[#1E364A] hover:bg-slate-50 dark:hover:bg-[#182C3A] text-[#10212E] dark:text-white disabled:opacity-40 cursor-pointer"
                    title="Previous page"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <span className="px-2 font-medium tabular-nums text-[#10212E] dark:text-white">
                    Page {pageNumber} of {numPages}
                  </span>
                  <button
                    type="button"
                    disabled={pageNumber >= numPages}
                    onClick={() => setPageNumber((p) => Math.min(numPages, p + 1))}
                    className="p-1 rounded border border-[#D5E0EA] dark:border-[#1E364A] hover:bg-slate-50 dark:hover:bg-[#182C3A] text-[#10212E] dark:text-white disabled:opacity-40 cursor-pointer"
                    title="Next page"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
              {showAllPages && (
                <span className="px-2 font-medium tabular-nums text-[#10212E] dark:text-white">
                  Showing all {numPages} pages
                </span>
              )}
              {numPages > 1 && (
                <button
                  type="button"
                  onClick={() => setShowAllPages((v) => !v)}
                  className={`px-2 py-1 rounded border text-[11px] font-medium inline-flex items-center gap-1 cursor-pointer ${
                    showAllPages
                      ? 'bg-[#EAF2FA] dark:bg-[#1E364A] border-[#1F5F99] text-[#1F5F99] dark:text-[#38BDF8]'
                      : 'border-[#D5E0EA] dark:border-[#1E364A] text-[#43525F] dark:text-[#B2C3D2] hover:bg-slate-50 dark:hover:bg-[#182C3A]'
                  }`}
                  title={showAllPages ? 'Switch to single page' : 'Scroll all pages'}
                >
                  <Layers className="w-3 h-3" />
                  <span>{showAllPages ? 'Single page' : 'All pages'}</span>
                </button>
              )}
            </>
          )}

          {(detectedKind === 'pdf' || detectedKind === 'image') && (
            <button
              type="button"
              onClick={() => setRotation((r) => (r + 90) % 360)}
              className="px-2 py-1 rounded border border-[#D5E0EA] dark:border-[#1E364A] hover:bg-slate-50 dark:hover:bg-[#182C3A] text-[#10212E] dark:text-white inline-flex items-center gap-1 cursor-pointer"
              title="Rotate 90°"
            >
              <RotateCw className="w-3.5 h-3.5" />
              <span>Rotate</span>
            </button>
          )}

          {detectedKind === 'docx' && (
            <span className="px-2 py-0.5 rounded bg-[#EAF2FA] dark:bg-[#1E364A] text-[#1F5F99] dark:text-[#38BDF8] font-medium">
              Word Document Preview
            </span>
          )}

          {detectedKind === 'text' && (
            <span className="px-2 py-0.5 rounded bg-[#EAF2FA] dark:bg-[#1E364A] text-[#1F5F99] dark:text-[#38BDF8] font-medium">
              Plain Text Preview
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {(detectedKind === 'pdf' || detectedKind === 'image') && (
            <>
              <button
                type="button"
                onClick={() => setZoom((z) => Math.max(0.5, Number((z - 0.25).toFixed(2))))}
                className="p-1 rounded border border-[#D5E0EA] dark:border-[#1E364A] hover:bg-slate-50 dark:hover:bg-[#182C3A] text-[#10212E] dark:text-white cursor-pointer"
                title="Zoom out"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="w-11 text-center tabular-nums font-medium text-[#43525F] dark:text-[#B2C3D2]">
                {Math.round(zoom * 100)}%
              </span>
              <button
                type="button"
                onClick={() => setZoom((z) => Math.min(2.5, Number((z + 0.25).toFixed(2))))}
                className="p-1 rounded border border-[#D5E0EA] dark:border-[#1E364A] hover:bg-slate-50 dark:hover:bg-[#182C3A] text-[#10212E] dark:text-white cursor-pointer"
                title="Zoom in"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setZoom(1.0);
                  setRotation(0);
                }}
                className="p-1 rounded border border-[#D5E0EA] dark:border-[#1E364A] hover:bg-slate-50 dark:hover:bg-[#182C3A] text-[#10212E] dark:text-white cursor-pointer"
                title="Reset zoom and rotation"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
            </>
          )}

          {activeObjectUrl && (
            <button
              type="button"
              onClick={handleTriggerDownload}
              className="ml-1 px-2.5 py-1 bg-[#1F5F99] hover:bg-[#184c7a] text-white rounded-[5px] font-medium inline-flex items-center gap-1 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download</span>
            </button>
          )}
        </div>
      </div>

      {/* Rendered Document Viewport */}
      {detectedKind === 'pdf' ? (
        <div
          ref={pdfViewportRef}
          className={`w-full ${maxHeightClass} overflow-auto p-4 flex flex-col items-center bg-slate-200/70 dark:bg-[#0A151E]`}
        >
          <Document
            file={blob}
            suspense={false}
            externalLinkRel="noopener noreferrer nofollow"
            externalLinkTarget="_blank"
            onLoadSuccess={handleDocumentLoadSuccess}
            onLoadError={handleDocumentLoadError}
            loading={
              <div className="py-16 flex flex-col items-center justify-center gap-2 text-[13px] text-[#43525F] dark:text-[#B2C3D2]">
                <Loader2 className="w-6 h-6 animate-spin text-[#1F5F99] dark:text-[#38BDF8]" />
                <span>Rendering PDF pages...</span>
              </div>
            }
            error={
              <div className="py-12 px-4 text-center text-[13px] text-[#C2412D] dark:text-rose-300">
                Could not parse PDF document. Please download the file to inspect locally.
              </div>
            }
            className="flex flex-col items-center gap-4"
          >
            {numPages > 0 &&
              (showAllPages ? (
                Array.from({ length: numPages }, (_, idx) => (
                  <div key={`page-${idx + 1}`} className="bg-white shadow-md rounded-[2px] overflow-hidden">
                    <Page
                      pageNumber={idx + 1}
                      width={containerWidth}
                      scale={zoom}
                      rotate={rotation}
                      suspense={false}
                      renderTextLayer
                      renderAnnotationLayer
                      loading={
                        <div className="w-[320px] h-[420px] flex items-center justify-center bg-white text-slate-400 text-xs">
                          Loading page {idx + 1}...
                        </div>
                      }
                    />
                  </div>
                ))
              ) : (
                <div className="bg-white shadow-md rounded-[2px] overflow-hidden">
                  <Page
                    pageNumber={pageNumber}
                    width={containerWidth}
                    scale={zoom}
                    rotate={rotation}
                    suspense={false}
                    renderTextLayer
                    renderAnnotationLayer
                    loading={
                      <div className="w-[320px] h-[420px] flex items-center justify-center bg-white text-slate-400 text-xs">
                        Rendering page {pageNumber}...
                      </div>
                    }
                  />
                </div>
              ))}
          </Document>
        </div>
      ) : detectedKind === 'image' && activeObjectUrl ? (
        <div
          className={`w-full ${maxHeightClass} overflow-auto p-4 flex items-center justify-center bg-slate-200/70 dark:bg-[#0A151E]`}
        >
          <img
            src={activeObjectUrl}
            alt={fileName}
            style={{
              transform: `scale(${zoom}) rotate(${rotation}deg)`,
              transformOrigin: 'center center',
            }}
            className="max-h-full max-w-full object-contain rounded shadow-md bg-white transition-transform duration-150"
          />
        </div>
      ) : detectedKind === 'docx' && docxNodes ? (
        <div className={`w-full ${maxHeightClass} overflow-auto p-4 sm:p-6 bg-slate-200/70 dark:bg-[#0A151E]`}>
          <div className="max-w-3xl mx-auto bg-white rounded-[4px] shadow-md p-6 sm:p-8 min-h-full">
            {docxNodes.length > 0 ? (
              docxNodes
            ) : (
              <p className="text-sm text-slate-500 italic">This Word document has no extractable text content.</p>
            )}
          </div>
        </div>
      ) : detectedKind === 'text' && plainText !== null ? (
        <div className={`w-full ${maxHeightClass} overflow-auto p-4 bg-slate-200/70 dark:bg-[#0A151E]`}>
          <pre className="max-w-3xl mx-auto bg-white text-slate-900 rounded-[4px] shadow-md p-5 text-xs font-mono whitespace-pre-wrap break-words leading-relaxed">
            {plainText}
          </pre>
        </div>
      ) : (
        <div className="w-full min-h-[240px] p-8 flex flex-col items-center justify-center text-center gap-3 bg-slate-50 dark:bg-[#0D1B26]">
          <FileText className="w-10 h-10 text-[#1F5F99] dark:text-[#38BDF8]" />
          <div className="space-y-1 max-w-md">
            <p className="font-semibold text-[14px] text-[#10212E] dark:text-white truncate">
              {fileName}
            </p>
            <p className="text-[12px] text-[#6B7A87]">
              Inline browser rendering is not supported for this binary format ({mimeType || blob.type || 'unknown'}). Download the file to open it locally.
            </p>
          </div>
          {activeObjectUrl && (
            <button
              type="button"
              onClick={handleTriggerDownload}
              className="px-4 py-2 bg-[#1F5F99] hover:bg-[#184c7a] text-white rounded-[6px] text-[13px] font-medium inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Download {fileName}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};
