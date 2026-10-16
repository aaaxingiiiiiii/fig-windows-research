; Copyright (c) fig-windows-research contributors.
; Licensed under the MIT License.
;
; figwin 终端补全的 Windows 安装包（T-059）。需要 Inno Setup 7.1 或更新版本（使用其中的官方简体中文界面）。
; 不要直接编译本文件：用 scripts/windows/build-installer.ps1 构建。它先打包 is.exe，把要安装的文件放进 StageDir，
; 再把版本号等参数传给 ISCC。
;
; 安装只影响当前用户，不需要管理员权限。修改 PowerShell 配置文件（$PROFILE）、PATH 和补全配置的步骤
; 由 scripts/windows/install.ps1 完成，卸载时由 uninstall.ps1 撤销（自测见 scripts/windows/test-install.ps1）。
; 升级和卸载前，如果有终端正在运行 is.exe，会请用户先关闭：运行中的 is.exe 会占用它解包的原生模块，资源无法更新或删除。
; 配置失败时安装程序以退出码 9 结束，再运行一次会继续完成；卸载脚本失败时，恢复所需的文件保存到 %LOCALAPPDATA%\figwin-recovery。
;
; 测试用的命令行参数（scripts/windows/test-installer.ps1 使用）：
;   /PROFILEPATH=<路径>  把初始化语句写到这个文件，而不是真实的 $PROFILE
;   /NOPATH=1            不修改用户的 PATH

#ifndef AppVersion
  #error 缺少 AppVersion：请用 scripts/windows/build-installer.ps1 构建
#endif
#ifndef NumericVersion
  #error 缺少 NumericVersion：请用 scripts/windows/build-installer.ps1 构建
#endif
#ifndef StageDir
  #error 缺少 StageDir：请用 scripts/windows/build-installer.ps1 构建
#endif
#if Ver < EncodeVer(7, 1, 0)
  #error 需要 Inno Setup 7.1 或更新版本（其中有官方的简体中文界面）
#endif
#ifndef OutputDir
  #define OutputDir "..\dist"
#endif

; 安装包显示的名称。改名只需要改这一行（D-015）
#define AppName "figwin 终端补全"

[Setup]
; AppId 用来识别同一个程序的升级，不要修改
AppId={{05A2CCCF-E90F-4E6B-A863-1E7256CE851E}
AppName={#AppName}
AppVersion={#AppVersion}
AppVerName={#AppName} {#AppVersion}
AppPublisher=fig-windows-research contributors
AppPublisherURL=https://github.com/xingdouiii-maker/fig-windows-research
AppSupportURL=https://github.com/xingdouiii-maker/fig-windows-research
VersionInfoVersion={#NumericVersion}
VersionInfoProductTextVersion={#AppVersion}
DefaultDirName={localappdata}\Programs\figwin
DisableDirPage=auto
DefaultGroupName={#AppName}
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
; Windows 10 1809：最早提供 ConPTY 的版本
MinVersion=10.0.17763
OutputDir={#OutputDir}
OutputBaseFilename=figwin-setup-{#AppVersion}
Compression=lzma2/max
SolidCompression=yes
WizardStyle=modern
LicenseFile={#StageDir}\licenses\LICENSE.txt
ChangesEnvironment=yes
CloseApplications=no
RestartApplications=no
SetupLogging=yes
UsePreviousTasks=yes
UninstallDisplayName={#AppName}
UninstallDisplayIcon={app}\is.exe

[Languages]
Name: "chs"; MessagesFile: "compiler:Languages\ChineseSimplified.isl"

[CustomMessages]
chs.GroupOptions=选项：
chs.TaskProfile=打开 PowerShell 7 时自动启用补全（在 PowerShell 配置文件 $PROFILE 末尾加两行，卸载时恢复原样）
chs.TaskConfig=创建默认的补全配置文件 .inshellisenserc（放在用户目录中，每项设置都有中文说明；已有时不覆盖）
chs.NeedPwsh=没有找到 PowerShell 7（pwsh.exe）。%n%n请先安装 PowerShell 7，再重新运行本安装程序。安装方法：在“终端”中运行%n%n    winget install --id Microsoft.PowerShell --source winget
chs.RunningPrepare=有终端正在使用补全（is.exe 正在运行），程序和资源无法更新。%n%n请关闭所有 PowerShell 标签和窗口，然后点击“上一步”，再点击“安装”。
chs.RunningUninstall=有终端正在使用补全（is.exe 正在运行），无法卸载。%n%n请关闭所有 PowerShell 标签和窗口，然后点击“确定”重试；点击“取消”退出卸载。
chs.Configuring=正在配置 PowerShell……
chs.ScriptFailed=配置 PowerShell 时出错（退出码 %1）。程序文件已经安装，但补全不会自动启用。%n%n详细信息见：%2%n%n可以在“设置 → 应用”中卸载后重新安装。
chs.UninstallScriptFailed=恢复 PowerShell 配置时出错（退出码 %1），配置文件和 PATH 可能还没有恢复。详细信息见：%2%n%n恢复所需的文件已保存在：%3%n关闭所有 PowerShell 标签后，在 PowerShell 7 中运行下面的命令完成恢复：%n%n    pwsh -NoProfile -File "%3\scripts\uninstall.ps1" -InstallDir "%3"
chs.UninstallNoPwsh=没有找到 PowerShell 7，无法自动恢复 PowerShell 的配置文件和 PATH。%n%n恢复所需的文件已保存在：%1%n重新安装 PowerShell 7 后，运行下面的命令完成恢复：%n%n    pwsh -NoProfile -File "%1\scripts\uninstall.ps1" -InstallDir "%1"
chs.RunningUnknown=无法确认是否有终端正在使用补全。%n%n请关闭所有 PowerShell 标签和窗口，然后点击“确定”继续；点击“取消”退出。
chs.Upgrade=已经安装过：这次只更新程序和资源，原来的选项保持不变。要改变选项，请先卸载再安装。
chs.EditConfig=编辑补全配置
chs.Readme=使用说明

[Tasks]
Name: "profile"; Description: "{cm:TaskProfile}"; GroupDescription: "{cm:GroupOptions}"
Name: "config"; Description: "{cm:TaskConfig}"; GroupDescription: "{cm:GroupOptions}"

[Files]
Source: "{#StageDir}\is.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "{#StageDir}\scripts\*.ps1"; DestDir: "{app}\scripts"; Flags: ignoreversion
Source: "{#StageDir}\config\inshellisenserc.toml"; DestDir: "{app}\config"; Flags: ignoreversion
Source: "{#StageDir}\licenses\*"; DestDir: "{app}\licenses"; Flags: ignoreversion
Source: "{#StageDir}\README.txt"; DestDir: "{app}"; Flags: ignoreversion isreadme

[Icons]
Name: "{group}\{cm:EditConfig}"; Filename: "{sys}\notepad.exe"; Parameters: """{%USERPROFILE}\.inshellisenserc"""
Name: "{group}\{cm:Readme}"; Filename: "{app}\README.txt"
Name: "{group}\{cm:UninstallProgram,{#AppName}}"; Filename: "{uninstallexe}"

[UninstallDelete]
Type: files; Name: "{app}\install-state.json"
Type: files; Name: "{app}\profile-backup.bin"
Type: files; Name: "{app}\install.log"
Type: dirifempty; Name: "{app}\scripts"
Type: dirifempty; Name: "{app}"

[Code]
var
  PwshPath: String;
  InstallScriptFailed: Boolean;

{ 查找 PowerShell 7：MSI 安装登记的 App Paths、默认安装目录、winget / 应用商店（MSIX）的应用执行别名、PATH }
function FindPwsh(): String;
var
  P: String;
begin
  Result := '';
  if RegQueryStringValue(HKLM, 'SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\pwsh.exe', '', P) and FileExists(RemoveQuotes(P)) then
  begin
    Result := RemoveQuotes(P);
    exit;
  end;
  if RegQueryStringValue(HKCU, 'SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\pwsh.exe', '', P) and FileExists(RemoveQuotes(P)) then
  begin
    Result := RemoveQuotes(P);
    exit;
  end;
  P := ExpandConstant('{commonpf64}\PowerShell\7\pwsh.exe');
  if FileExists(P) then
  begin
    Result := P;
    exit;
  end;
  P := ExpandConstant('{localappdata}\Microsoft\WindowsApps\pwsh.exe');
  if FileExists(P) then
  begin
    Result := P;
    exit;
  end;
  Result := FileSearch('pwsh.exe', GetEnv('PATH'));
end;

function IsPwsh7(const Path: String): Boolean;
var
  Code: Integer;
begin
  Result := Exec(Path, '-NoLogo -NoProfile -NonInteractive -Command "exit [int]($PSVersionTable.PSVersion.Major -lt 7)"', '', SW_HIDE, ewWaitUntilTerminated, Code) and (Code = 0);
end;

function WqlString(const S: String): String;
begin
  Result := S;
  StringChangeEx(Result, '\', '\\', True);
  StringChangeEx(Result, '''', '\''', True);
end;

// 是否有进程正在运行这个程序：0 没有，1 有，2 无法确认。先用 WMI 查询；查询失败时改用 PowerShell 检查
function RunningState(const ExePath, Pwsh: String): Integer;
var
  Locator, Services, Processes: Variant;
  PsPath: String;
  Code: Integer;
begin
  Result := 2;
  try
    Locator := CreateOleObject('WbemScripting.SWbemLocator');
    Services := Locator.ConnectServer('.', 'root\CIMV2');
    Processes := Services.ExecQuery('SELECT ProcessId FROM Win32_Process WHERE ExecutablePath = ''' + WqlString(ExePath) + '''');
    if Processes.Count > 0 then
      Result := 1
    else
      Result := 0;
    exit;
  except
    Log('WMI 查询失败：' + GetExceptionMessage);
  end;
  if Pwsh = '' then
    exit;
  PsPath := ExePath;
  StringChangeEx(PsPath, '''', '''''', True);
  if Exec(Pwsh, '-NoLogo -NoProfile -NonInteractive -Command "if (Get-Process -Name is -ErrorAction SilentlyContinue | Where-Object { $_.Path -eq ''' + PsPath + ''' }) { exit 1 } else { exit 0 }"', '', SW_HIDE, ewWaitUntilTerminated, Code) and ((Code = 0) or (Code = 1)) then
    Result := Code
  else
    Log('用 PowerShell 检查进程也失败了');
end;

function Quote(const S: String): String;
begin
  Result := '"' + S + '"';
end;

function ScriptParams(const Script: String): String;
begin
  Result := '-NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File ' + Quote(ExpandConstant('{app}\scripts\' + Script));
end;

function IsUpgrade(): Boolean;
begin
  Result := FileExists(ExpandConstant('{app}\install-state.json'));
end;

function InitializeSetup(): Boolean;
begin
  PwshPath := FindPwsh();
  Result := False;
  if PwshPath <> '' then
    Result := IsPwsh7(PwshPath);
  if Result then
    Log('PowerShell 7：' + PwshPath)
  else
  begin
    Log('没有找到 PowerShell 7');
    SuppressibleMsgBox(CustomMessage('NeedPwsh'), mbCriticalError, MB_OK, IDOK);
  end;
end;

{ 升级时不显示选项页：选项只在第一次安装时生效 }
function ShouldSkipPage(PageID: Integer): Boolean;
begin
  Result := False;
  // 选择目录之前 app 常量还没有确定，不能读取
  if PageID = wpSelectTasks then
    Result := IsUpgrade();
end;

function UpdateReadyMemo(Space, NewLine, MemoUserInfoInfo, MemoDirInfo, MemoTypeInfo, MemoComponentsInfo, MemoGroupInfo, MemoTasksInfo: String): String;
begin
  Result := MemoDirInfo;
  if IsUpgrade() then
    Result := Result + NewLine + NewLine + CustomMessage('Upgrade')
  else if MemoTasksInfo <> '' then
    Result := Result + NewLine + NewLine + MemoTasksInfo;
end;

function PrepareToInstall(var NeedsRestart: Boolean): String;
var
  State: Integer;
begin
  Result := '';
  State := RunningState(ExpandConstant('{app}\is.exe'), PwshPath);
  // 无法确认时不放行：静默安装直接停止；有界面时请用户确认已经关闭终端
  if State = 1 then
    Result := CustomMessage('RunningPrepare')
  else if State = 2 then
  begin
    if WizardSilent() then
      Result := CustomMessage('RunningPrepare')
    else if SuppressibleMsgBox(CustomMessage('RunningUnknown'), mbConfirmation, MB_OKCANCEL, IDCANCEL) <> IDOK then
      Result := CustomMessage('RunningPrepare');
  end;
end;

procedure RunInstallScript();
var
  Params, LogFile, TestProfile: String;
  Code: Integer;
begin
  LogFile := ExpandConstant('{app}\install.log');
  Params := ScriptParams('install.ps1') + ' -Source ' + Quote(ExpandConstant('{app}\is.exe')) + ' -InstallDir ' + Quote(ExpandConstant('{app}')) + ' -LogPath ' + Quote(LogFile);
  if WizardIsTaskSelected('config') then
    Params := Params + ' -ConfigTemplate ' + Quote(ExpandConstant('{app}\config\inshellisenserc.toml'));
  if not WizardIsTaskSelected('profile') then
    Params := Params + ' -NoProfileUpdate';
  TestProfile := ExpandConstant('{param:PROFILEPATH|}');
  if TestProfile <> '' then
    Params := Params + ' -ProfilePath ' + Quote(TestProfile);
  if ExpandConstant('{param:NOPATH|0}') = '1' then
    Params := Params + ' -NoPathUpdate';
  WizardForm.StatusLabel.Caption := CustomMessage('Configuring');
  Log('运行：' + PwshPath + ' ' + Params);
  if not Exec(PwshPath, Params, ExpandConstant('{app}'), SW_HIDE, ewWaitUntilTerminated, Code) or (Code <> 0) then
  begin
    Log('install.ps1 失败，退出码 ' + IntToStr(Code));
    InstallScriptFailed := True;
    SuppressibleMsgBox(FmtMessage(CustomMessage('ScriptFailed'), [IntToStr(Code), LogFile]), mbError, MB_OK, IDOK);
  end;
end;

procedure CurStepChanged(CurStep: TSetupStep);
begin
  if CurStep = ssPostInstall then
    RunInstallScript();
end;

// 文件已经装好但配置失败时，以退出码 9 结束（静默安装时调用方据此知道失败）。再运行一次安装程序会继续完成剩下的步骤
function GetCustomSetupExitCode(): Integer;
begin
  Result := 0;
  if InstallScriptFailed then
    Result := 9;
end;

function InitializeUninstall(): Boolean;
var
  State: Integer;
begin
  Result := True;
  PwshPath := FindPwsh();
  repeat
    State := RunningState(ExpandConstant('{app}\is.exe'), PwshPath);
    // 没有 PowerShell 7 时 is.exe 无法运行补全会话，无法确认也可以继续
    if (State = 0) or ((State = 2) and (PwshPath = '')) then
      exit;
    if SuppressibleMsgBox(CustomMessage('RunningUninstall'), mbError, MB_OKCANCEL, IDCANCEL) = IDCANCEL then
    begin
      Result := False;
      exit;
    end;
  until False;
end;

// 卸载脚本没能完成时，在删除程序文件之前，把恢复所需的文件复制到单独的文件夹，返回它的路径
function SaveRecoveryFiles(): String;
var
  Names: TArrayOfString;
  I: Integer;
begin
  Result := ExpandConstant('{localappdata}\figwin-recovery\') + GetDateTimeString('yyyymmdd-hhnnss', #0, #0);
  ForceDirectories(Result + '\scripts');
  SetArrayLength(Names, 3);
  Names[0] := 'install-state.json';
  Names[1] := 'profile-backup.bin';
  Names[2] := 'install.log';
  for I := 0 to GetArrayLength(Names) - 1 do
    if FileExists(ExpandConstant('{app}\') + Names[I]) then
      FileCopy(ExpandConstant('{app}\') + Names[I], Result + '\' + Names[I], False);
  SetArrayLength(Names, 4);
  Names[0] := 'install.ps1';
  Names[1] := 'uninstall.ps1';
  Names[2] := 'profile-file.ps1';
  Names[3] := 'user-path.ps1';
  for I := 0 to GetArrayLength(Names) - 1 do
    FileCopy(ExpandConstant('{app}\scripts\') + Names[I], Result + '\scripts\' + Names[I], False);
  Log('恢复所需的文件已保存到 ' + Result);
end;

procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
var
  Pwsh, Params, LogFile: String;
  Code: Integer;
begin
  if (CurUninstallStep <> usUninstall) or not FileExists(ExpandConstant('{app}\install-state.json')) then
    exit;
  Pwsh := PwshPath;
  if Pwsh = '' then
  begin
    Log('没有找到 PowerShell 7，跳过 uninstall.ps1');
    SuppressibleMsgBox(FmtMessage(CustomMessage('UninstallNoPwsh'), [SaveRecoveryFiles()]), mbInformation, MB_OK, IDOK);
    exit;
  end;
  LogFile := ExpandConstant('{%TEMP}\figwin-uninstall.log');
  Params := ScriptParams('uninstall.ps1') + ' -InstallDir ' + Quote(ExpandConstant('{app}')) + ' -KeepInstallDir -LogPath ' + Quote(LogFile);
  Log('运行：' + Pwsh + ' ' + Params);
  if not Exec(Pwsh, Params, ExpandConstant('{app}'), SW_HIDE, ewWaitUntilTerminated, Code) or (Code <> 0) then
  begin
    Log('uninstall.ps1 失败，退出码 ' + IntToStr(Code));
    SuppressibleMsgBox(FmtMessage(CustomMessage('UninstallScriptFailed'), [IntToStr(Code), LogFile, SaveRecoveryFiles()]), mbError, MB_OK, IDOK);
  end;
end;
