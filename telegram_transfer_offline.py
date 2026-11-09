"""Recepción temporal acotada; no realiza red ni publica archivos de audio."""

from contextlib import contextmanager
from pathlib import Path
from tempfile import TemporaryDirectory

from telegram_import import MAX_AUDIO_BYTES, approval_matches


class TransferRejected(ValueError):
    """La transferencia no coincide con los límites declarados."""


@contextmanager
def temporary_audio(chunks, *, expected_size, directory):
    """Recibe bytes en un directorio temporal y los elimina al salir.

    El llamador debe proporcionar un directorio privado y seguro. Esta función
    no verifica el formato ni autoriza conservar o publicar el contenido.
    """
    if type(expected_size) is not int or not 0 < expected_size <= MAX_AUDIO_BYTES:
        raise TransferRejected('Tamaño declarado inválido')
    with TemporaryDirectory(prefix='telegram-audio-', dir=directory) as temp_dir:
        path = Path(temp_dir) / 'candidate'
        total = 0
        with path.open('xb') as output:
            for chunk in chunks:
                if not isinstance(chunk, bytes):
                    raise TransferRejected('Bloque inválido')
                total += len(chunk)
                if total > expected_size or total > MAX_AUDIO_BYTES:
                    raise TransferRejected('Transferencia demasiado grande')
                output.write(chunk)
        if total != expected_size:
            raise TransferRejected('Transferencia incompleta')
        yield path


@contextmanager
def approved_temporary_audio(chunks, *, candidate, approval, clock, directory):
    """Une aprobación y recepción offline; no autentica ni descarga por red.

    El reloj confiable y un candidato revalidado son responsabilidad del
    llamador. La aprobación no es de un solo uso y no acredita derechos.
    """
    if not approval_matches(approval, candidate, now=clock()):
        raise TransferRejected('Aprobación inválida o vencida')
    with temporary_audio(chunks, expected_size=candidate.size, directory=directory) as path:
        if not approval_matches(approval, candidate, now=clock()):
            raise TransferRejected('Aprobación vencida durante la recepción')
        yield path
