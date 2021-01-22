import React from "react";
import ReactDOM from "react-dom";
import "./index.css";

class AudioDeviceManager {
  constructor() {
    this.currentInputDevice = null;
    this.currentOutputDevice = null;

    this.audioElement = document.createElement("audio");
    this.audioElement.src = "guitar.mp3";
    this.audioElement.loop = true;
    this.audioElement.volume = 0.2;
    document.body.append(this.audioElement);

    this.createContext();
  }

  createContext() {
    if (this.ctx) {
      this.ctx.close();
    }
    if (this.audioBuffer) {
      this.audioBuffer.stop();
    }

    this.ctx = new (window.AudioContext || window.webkitAudioContext)();

    this.outputNode = this.ctx.createGain();
    this.outputNode.connect(this.ctx.destination);

    this.analyser = this.ctx.createAnalyser();
    this.analyser.connect(this.outputNode);
    this.analyser.fftSize = 32;
    this.analyserData = new Uint8Array(this.analyser.frequencyBinCount);

    this.audioBuffer = null;
    this.decodedAudioData = null;

    if (this.currentInputDevice) {
      this.setInputDevice(this.currentInputDevice);
    }
    if (this.currentOutputDevice) {
      this.setOutputDevice(this.currentOutputDevice);
    }
  }

  resumeContext() {
    if (this.ctx.state === "suspended") {
      this.ctx.resume();
    }
  }

  async getDevices(kind) {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    const devices = (await navigator.mediaDevices.enumerateDevices()).filter((device) => device.kind === kind);
    devices.sort((a, b) => (a.label.toLowerCase() > b.label.toLowerCase() ? 1 : -1));

    // We need to call getUserMedia media in order to enumerateDevices with labels.
    // Then we have to stop the audio track, since Firefox thinks we're still using
    // the stream if we try to switch devices later.
    for (const track of stream.getAudioTracks()) {
      track.stop();
    }

    return devices;
  }

  async setInputDevice(deviceId) {
    this.currentInputDevice = deviceId;

    if (this.currentSource) {
      this.currentSource.disconnect();
    }

    if (this.inputStream) {
      for (const track of this.getInputTracks()) {
        track.stop();
      }
    }

    this.inputStream = await navigator.mediaDevices.getUserMedia({ audio: { deviceId } });
    this.currentSource = this.ctx.createMediaStreamSource(this.inputStream);
    this.currentSource.connect(this.analyser);
  }

  async setOutputDevice(deviceId) {
    this.currentOutputDevice = deviceId;

    this.outputNode.disconnect();
    const dest = this.ctx.createMediaStreamDestination();
    this.outputNode.connect(dest);

    const audioOutput = new Audio();
    audioOutput.srcObject = dest.stream;
    audioOutput.setSinkId(deviceId);
    audioOutput.play();

    this.audioElement.setSinkId(deviceId);
  }

  getAnalyserLevel() {
    this.analyser.getByteFrequencyData(this.analyserData);
    let sum = 0;
    for (let i = 0; i < this.analyserData.length; i++) {
      sum += this.analyserData[i] / 255;
    }
    sum = sum / this.analyserData.length;
    return sum;
  }

  getInputTracks() {
    return this.inputStream.getAudioTracks();
  }

  getConstraints() {
    return navigator.mediaDevices.getSupportedConstraints();
  }

  toggleAudioElement() {
    if (this.audioElement.paused) {
      this.audioElement.play();
    } else {
      this.audioElement.pause();
    }
  }

  async toggleAudioBuffer() {
    if (this.audioBuffer) {
      this.audioBuffer.stop();
      this.audioBuffer = null;

      return true;
    } else {
      this.audioBuffer = this.ctx.createBufferSource();

      if (!this.decodedAudioData) {
        const audioData = await fetch("beat.mp3").then((resp) => resp.arrayBuffer());
        this.decodedAudioData = await this.ctx.decodeAudioData(audioData);
      }

      this.audioBuffer.buffer = this.decodedAudioData;

      this.audioBuffer.connect(this.outputNode);
      this.audioBuffer.loop = true;
      this.audioBuffer.start();

      return false;
    }
  }
}

class AudioMeter extends React.Component {
  state = {
    value: 0
  }
  updateValue = () => {
    const value = this.props.audioDeviceManager.getAnalyserLevel();
    this.setState({ value });
    window.requestAnimationFrame(this.updateValue);
  }
  componentDidMount() {
    requestAnimationFrame(this.updateValue);
  }
  render() {
    return (
      <div id="meter">
        <div id="bar" style={{ width: `${this.state.value * 100}%` }} />
      </div>
    );
  }
}

class Devices extends React.PureComponent {
  render() {
    const { title, value: devices, setDevice } = this.props;

    return (
      <div>
        <h2>{title}:</h2>
        {devices.length === 0 ? "- no devices -" : null}
        {devices.map((device, i) => (
          <div key={i} className="device">
            <button className="useDevice" onClick={() => setDevice(device.deviceId)}>use</button>
            <div key={i} className="deviceInfo">
              <div>
                <label>label:</label>
                <span>{device.label}</span>
              </div>

              <div>
                <label>kind:</label>
                <span style={{ backgroundColor: stringToColor(device.kind) }}>{device.kind}</span>
              </div>

              <div>
                <label>deviceId:</label>
                <span style={{ backgroundColor: stringToColor(device.deviceId) }}>{device.deviceId}</span>
              </div>

              <div>
                <label>groupId:</label>
                <span style={{ backgroundColor: stringToColor(device.groupId) }}>{device.groupId}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }
}

function stringToColor(str) {
  var hash = 0;
  for (var i = 0; i < str.length; i++) {
    hash = (hash + str.charCodeAt(i) * 20) % 255;
  }
  return `hsl(${(hash / 255) * 360}, 100%, 90%)`;
}

class Root extends React.PureComponent {
  state = {
    status: "",
    inputDevices: [],
    outputDevices: [],
    inputTracks: [],
    constraints: [],
    meter: 0,
    audioElementPaused: true,
    audioBufferPaused: true,
  };

  audioDeviceManager = new AudioDeviceManager();

  componentDidMount() {
    document.addEventListener("click", () => this.audioDeviceManager.resumeContext());
  }

  getConstraints() {
    this.setState({ constraints: this.audioDeviceManager.getConstraints() });
  }

  async getDevices(kind, stateProp) {
    try {
      this.setState({ status: "getting devices" });

      const devices = await this.audioDeviceManager.getDevices(kind);

      this.setState({ [stateProp]: devices });
      this.setState({ status: devices.length ? "got devices" : "no devices found" });
    } catch (e) {
      this.setState({ status: `error getting devices ${e}` });
      console.error(e);
    }
  }

  async setInputDevice(deviceId) {
    this.setState({ status: "getting device" });
    this.setState({ inputTracks: [] });
    try {
      await this.audioDeviceManager.setInputDevice(deviceId);
      this.setState({ status: "got device" });
      this.setState({ inputTracks: await this.audioDeviceManager.getInputTracks() });
    } catch (e) {
      this.setState({ status: `error getting device ${e}` });
      console.error(e);
    }
  }

  async setOutputDevice(deviceId) {
    this.setState({ status: "setting output device" });
    this.audioDeviceManager.setOutputDevice(deviceId);
    this.setState({ status: "set output device" });
  }

  toggleAudioElement() {
    this.audioDeviceManager.toggleAudioElement();
    this.setState((state) => ({audioElementPaused: !state.audioElementPaused}));
  }

  async toggleAudioBuffer() {
    const audioBufferPaused = await this.audioDeviceManager.toggleAudioBuffer();
    this.setState({ audioBufferPaused });
  }

  recreateContext() {
    this.setState({ status: "recreating context" });
    this.audioDeviceManager.createContext();
    this.setState({ audioBufferPaused: true });
    this.setState({ status: "context recreated" });
  }

  render() {
    return (
      <>
        <h1>mic test</h1>
        
        <p>
          A basic set of web audio tests including a local microphone echo test, 
          audio playback and output selection (where supported). <br />
          Source code on <a href="https://github.com/brianpeiris/mic-test" target="blank">github</a>.
        </p>

        <div id="status">status: {this.state.status || "-"}</div>

        <AudioMeter audioDeviceManager={this.audioDeviceManager} />

        <button onClick={() => this.getDevices("audioinput", "inputDevices")}>
          get input devices
        </button>

        <button onClick={() => this.getDevices("audiooutput", "outputDevices")}>
          get output devices
        </button>

        <br />

        <button onClick={() => this.toggleAudioElement()}>
          {this.state.audioElementPaused ? "play" : "pause"} audio element
        </button>

        <button onClick={() => this.toggleAudioBuffer()}>
          {this.state.audioBufferPaused ? "play" : "pause"} audio buffer
        </button>

        <br />

        <button onClick={() => this.recreateContext()}>
          recreate context
        </button>

        <button onClick={() => this.getConstraints()}>
          get constraints
        </button>

        <h2>input tracks:</h2>
        <div>{this.state.inputTracks.length === 0 ? "- no input tracks -" : null}</div>
        {this.state.inputTracks.map((track, i) => (
          <div key={i} className="track">
            <div>
              <label>label:</label>
              <span>{track.label}</span>
            </div>

            <div>
              <label>enabled:</label>
              <span>{String(track.enabled)}</span>
            </div>

            <div>
              <label>muted:</label>
              <span>{String(track.muted)}</span>
            </div>

            <div>
              <label>readyState:</label>
              <span>{track.readyState}</span>
            </div>
          </div>
        ))}

        <Devices
          title="input devices"
          value={this.state.inputDevices}
          setDevice={(deviceId) => this.setInputDevice(deviceId)}
        />

        <Devices
          title="output devices"
          value={this.state.outputDevices}
          setDevice={(deviceId) => this.setOutputDevice(deviceId)}
        />

        <h2>constraints:</h2>
        <div>{Object.entries(this.state.constraints).length === 0 ? "- no constraints -" : null}</div>
        {Object.entries(this.state.constraints).map(([name], i) => (
          <div key={i} className="constraint">
            <div key={i} className="constraintInfo">
              {name}
            </div>
          </div>
        ))}
      </>
    );
  }
}

const root = document.createElement("div");
root.id = "root";
document.body.append(root);

ReactDOM.render(<Root />, root);
