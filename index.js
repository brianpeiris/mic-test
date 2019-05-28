import React from "react";
import ReactDOM from "react-dom";

class Root extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      status: "",
      devices: [],
      tracks: [],
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
  async getMedia() {
    this.setState({ status: "getting media" });
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const devices = await navigator.mediaDevices.enumerateDevices();
      this.setState({ devices });
      this.setState({ status: "got media" });
      // We need to getUserMedia media to enumerateDevices with labels.
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
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: deviceId } });
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
      <div>
        <div id="status">{this.state.status}</div>
        <div id="meter">
          <div id="bar" style={{ width: `${this.state.meter * 100}%` }} />
        </div>
        {this.state.tracks.map((track, i) => (
          <div key={i} className="track">
            id: {track.id} <br />
            label: {track.label} <br />
            kind: {track.kind} <br />
            enabled: {track.enabled} <br />
            muted: {track.muted} <br />
            readyState: {track.readyState} <br />
          </div>
        ))}
        <button onClick={() => this.getMedia()}>get media</button>
        {this.state.devices.map((device, i) => (
          <div key={i} className="device">
            <button onClick={() => this.useDevice(device.deviceId)}>use</button> <br />
            label: {device.label} <br />
            kind: {device.kind} <br />
            group: {device.groupId} <br />
            device: {device.deviceId} <br />
          </div>
        ))}
      </div>
    );
  }
}

ReactDOM.render(<Root />, document.getElementById("root"));
