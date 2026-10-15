@echo off
rem FlowMonitor: inicia a ponte com o Home Assistant junto com o Windows, sem janela.
rem O painel abre sozinho em http://localhost:8080 quando o Home Assistant responder.
rem Para desativar, apague este arquivo da pasta Inicializar (Win+R, shell:startup).
rem Ajuste FM abaixo para o caminho onde o flowmonitor.py esta no seu PC.
set "FM=%USERPROFILE%\Documents\flowmonitor\live\flowmonitor.py"
where pyw >nul 2>nul
if %errorlevel%==0 (
  start "" pyw "%FM%" --service --open
) else (
  start "" pythonw "%FM%" --service --open
)
