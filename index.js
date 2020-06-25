import React from "react";
import ReactDOM from "react-dom";
import "./index.css";

class Root extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      status: "",
      devices: [],
      tracks: [],
      constraints: [],
      meter: 0
    };
  }
  componentDidMount() {
    setInterval(() => {
      if (!this.analyser) return;
      this.analyser.getByteFrequencyData(this.data);
      let sum = 0;
      for (let i = 0; i < this.data.length; i++) {
        sum += this.data[i] / 255;
      }
      sum = sum / this.data.length;
      this.setState({ meter: sum });
    }, 5);
    document.addEventListener("click", () => {
      if (!this.ctx || this.ctx.state !== "suspended") return;
      this.ctx.resume();
    });
  }
  getConstraints() {
    this.setState({ constraints: navigator.mediaDevices.getSupportedConstraints() });
  }
  async getMedia() {
    this.setState({ status: "getting media" });
    try {
      const stream = await navigator.mediaDevices.getUserMedia({audio: true});
      const devices = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === "audioinput");
      this.setState({ devices });
      this.setState({ status: "got media" });
      // We need to call getUserMedia media in order to enumerateDevices with labels.
      // Then we have to stop the audio track, since Firefox thinks we're still using
      // the stream if we try to switch devices later.
      for (const track of stream.getAudioTracks()) {
        track.stop();
      }
    } catch (e) {
      this.setState({ status: `error getting media ${e}` });
      console.error(e);
    }
  }
  async stopAnalyser() {
    if (this.currentSource) this.currentSource.disconnect(this.analyser);
    if (this.ctx) await this.ctx.close();
    this.analyser = null;
    this.data = null;
    this.ctx = null;
  }
  startAnalyser(stream) {
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 32;
    this.data = new Uint8Array(this.analyser.frequencyBinCount);
    this.currentSource = this.ctx.createMediaStreamSource(stream);
    this.currentSource.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);
  }
  async useDevice(deviceId) {
    this.setState({ status: "getting device" });
    for (const track of this.state.tracks) {
      track.stop();
    }
    await this.stopAnalyser();
    this.setState({ tracks: [] });
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { deviceId: deviceId }
      });
      this.setState({ status: "got device" });
      this.setState({ tracks: stream.getAudioTracks() });
      this.startAnalyser(stream);
    } catch (e) {
      this.setState({ status: `error getting device ${e}` });
      console.error(e);
    }
  }
  render() {
    const track = this.state.track;
    return (
      <>
        <h1>mic test</h1>
        <div id="status">{this.state.status}</div>
        <div id="meter">
          <div id="bar" style={{ width: `${this.state.meter * 100}%` }} />
        </div>
        {this.state.tracks.map((track, i) => (
          <div key={i} className="track">
            <label>label:</label> {track.label} <br />
            <label>enabled:</label> {"" + track.enabled} <br />
            <label>muted:</label> {"" + track.muted} <br />
            <label>readyState:</label> {track.readyState} <br />
          </div>
        ))}
        <button onClick={() => this.getMedia()}>get media</button>
        <button onClick={() => this.getConstraints()}>get constraints</button>
        {this.state.devices.map((device, i) => (
          <div key={i} className="device">
            <button onClick={() => this.useDevice(device.deviceId)}>use</button>
            <div key={i} className="deviceInfo">
              <label>label:</label> {device.label} <br />
              <label>kind:</label> {device.kind} <br />
            </div>
          </div>
        ))}
        {Object.entries(this.state.constraints).map(([name], i) => (
          <div key={i} className="constraint">
            <div key={i} className="constraintInfo">
              <label>name:</label> {name} <br />
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
