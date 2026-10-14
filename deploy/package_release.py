"""Package the shared site without local secrets or runtime data."""
from collections import Counter
from datetime import datetime, timedelta, timezone
from hashlib import sha256
from pathlib import Path
import json
import os
import zipfile

ROOT = Path(__file__).resolve().parents[1]
DIRECTORIES = ['src', 'backend', 'public', 'study-room', 'shanyao', 'deploy', 'docs', 'dist']
ROOT_FILES = ['package.json', 'package-lock.json', 'vite.config.js', 'index.html', 'README.md', 'LICENSE', '.gitignore']
SKIP_DIRS = {'.git', 'node_modules', '.venv', '__pycache__', '.pytest_cache', 'uploads', 'runtime', 'output', '.playwright-cli', 'wechat-application'}
SKIP_SUFFIXES = {'.db', '.sqlite', '.sqlite3', '.log', '.pyc', '.pyo', '.pem', '.key', '.pfx', '.zip', '.gz'}
PREFIX = 'mont-away-remote/'

def main():
    required = {'dist/index.html', 'dist/shanyao/index.html', 'backend/app/web.py', 'backend/app/study_room/router.py', 'study-room/data/questions.json', 'deploy/nginx-shared.conf', 'docs/STUDY_INTEGRATION.md', 'backend/app/study_room/importing.py', 'dist/study-assets/templates/questions.csv', 'dist/study-assets/templates/questions.json'}
    for name in required:
        if not (ROOT / name).is_file():
            raise SystemExit(f'Missing {name}; build the project first.')
    bank = json.loads((ROOT / 'study-room/data/questions.json').read_text(encoding='utf-8'))
    materials = json.loads((ROOT / 'study-room/data/materials.json').read_text(encoding='utf-8'))
    required.update({'study-room/data/materials.json', 'study-room/data/focus-priorities.json', 'study-room/src/FocusPriority.tsx', 'study-room/src/priorities.js', 'docs/STUDY_PRIORITIES.md', 'study-room/src/mnemonic-cues.js', 'study-room/src/MnemonicPanel.tsx', 'study-room/src/mnemonics.js', 'study-room/src/mnemonics.css'})
    required.update({'study-room/data/predictions.json', 'study-room/src/prediction/PredictionMode.tsx', 'study-room/src/prediction/predictions.js', 'study-room/src/prediction/prediction.css'})
    required.update({'study-room/data/prediction-learning.json', 'study-room/src/prediction/PredictionLearning.tsx', 'study-room/src/prediction/learning.js', 'study-room/src/prediction/learning.css'})
    for q in bank:
        for url in [q['sourceUrl'], *q['figures'], *q.get('answerFigures', [])]:
            required.add('dist/study-assets' + url)
    for name in required:
        if not (ROOT / name).is_file():
            raise SystemExit(f'Missing {name}; build the project first.')
    files = [ROOT / name for name in ROOT_FILES]
    for directory in DIRECTORIES:
        for current, dirs, names in os.walk(ROOT / directory, followlinks=False):
            dirs[:] = [d for d in dirs if d not in SKIP_DIRS and not d.startswith('.') and not (Path(current) / d).is_symlink()]
            for name in sorted(names):
                path = Path(current) / name
                if path.is_symlink() or name.startswith(('.env', '~$')) or path.suffix.lower() in SKIP_SUFFIXES or name.endswith(('-wal', '-shm', '-journal')):
                    continue
                files.append(path)
    files.sort(key=lambda p: p.relative_to(ROOT).as_posix())
    stamp = datetime.now(timezone(timedelta(hours=8))).strftime('%Y%m%d-%H%M%S')
    output = ROOT / 'output' / 'releases'
    output.mkdir(parents=True, exist_ok=True)
    archive = output / f'shanyao-study-{stamp}.zip'
    notes = f'''SHANYAO + STUDY DEPLOYMENT PACKAGE

Routes: / = question practice; /shanyao/ = existing travel website.
Includes source, production dist, {len(materials)} PDFs, {len(bank)} questions and original/solution images, CSV/JSON templates, FastAPI backend and deployment instructions.
Study features: 60 question-specific prediction mnemonics with recall practice, expandable explanations and transfer questions, guarded against stale public edits, plus subnet/HTTP tables and coding waveforms; exam-only prediction mode with a frozen 31-question paper, 60-question extended selection, four question types, six calculation templates, per-question exam evidence, historical coverage and a pending future result; evidence-based 1-5 star study priorities, topic/star filters, textbook page references and deduplicated exam evidence; practice mode with visible answers, answer mode with instant click/typing feedback and retry, editable textbook-referenced mnemonic cards (associations, homophones, rhymes and worked-step reminders) that open with answers/explanations, local wrong-answer notebook, per-blank checks and self assessment, saved mode preference, personal themes, expanded original images, anonymous question/image uploads and batch import.
Read docs/STUDY_INTEGRATION.md and deploy/nginx-shared.conf first.

The current dist uses same-origin APIs. The public SEO domain remains sy.chexi.tech.
If your domain or public map settings change, configure VITE_SHANYAO_* and rebuild with npm ci / npm run build.

Keep the existing server .env, travel database, uploads and credentials. None are included here.
Set SHANYAO_STUDY_DATABASE_PATH to a persistent writable path, e.g. /srv/shanyao/shared/study.sqlite3.
The study database is independent of the existing travel database and is initialized on first use.
Online revisions from the separate Sites/Cloudflare website are not included in the initial question bank.

Install backend/requirements.txt into the server Python environment. Run the existing FastAPI service.
Configure the proxy to preserve paths, including /shanyao/. The old all-paths-to-index fallback is unsuitable.
This package has not been uploaded or deployed to your server.
'''
    manifest = {'created_at': datetime.now(timezone(timedelta(hours=8))).isoformat(), 'files': {}}
    with zipfile.ZipFile(archive, 'x', compression=zipfile.ZIP_DEFLATED, compresslevel=6) as bundle:
        for path in files:
            relative = path.relative_to(ROOT).as_posix()
            data = path.read_bytes()
            bundle.writestr(PREFIX + relative, data)
            manifest['files'][relative] = {'bytes': len(data), 'sha256': sha256(data).hexdigest()}
        bundle.writestr(PREFIX + 'DEPLOY_PACKAGE.txt', notes)
        bundle.writestr(PREFIX + 'PACKAGE_MANIFEST.json', json.dumps(manifest, ensure_ascii=False, indent=2))
    with zipfile.ZipFile(archive) as bundle:
        if bundle.testzip() is not None:
            raise SystemExit('Archive CRC verification failed')
        entries = set(bundle.namelist())
        if not {PREFIX + name for name in required} <= entries:
            raise SystemExit('Missing required deployment entries')
        for name in entries:
            if any(part in SKIP_DIRS for part in Path(name).parts) or Path(name).name.startswith('.env') or Path(name).suffix.lower() in SKIP_SUFFIXES:
                raise SystemExit(f'Excluded file found in archive: {name}')
        bank = json.loads(bundle.read(PREFIX + 'study-room/data/questions.json'))
        assert len(bank) == len({q['id'] for q in bank}) == sum(m['questionCount'] for m in materials)
        for name in required:
            assert bundle.read(PREFIX + name) == (ROOT / name).read_bytes(), name
        assert sum(name.startswith(PREFIX + 'dist/study-assets/sources/') and name.endswith('.pdf') for name in entries) == len(materials)
    digest = sha256(archive.read_bytes()).hexdigest()
    checksum = archive.with_suffix('.zip.sha256')
    checksum.write_text(f'{digest}  {archive.name}\n', encoding='ascii')
    output.joinpath('DEPLOY_PACKAGE.txt').write_text(notes, encoding='utf-8')
    print(json.dumps({'archive': str(archive), 'size_mib': round(archive.stat().st_size / 1024 / 1024, 2), 'file_count': len(entries), 'questions': len(bank), 'pdfs': len(materials), 'crc_verified': True, 'checksum': str(checksum)}, ensure_ascii=False))

if __name__ == '__main__':
    main()
