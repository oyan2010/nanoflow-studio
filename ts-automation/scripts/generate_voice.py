import sys
import argparse
import asyncio
import edge_tts
import os

async def generate_audio(text, voice, output_file):
    try:
        communicate = edge_tts.Communicate(text, voice)
        await communicate.save(output_file)
        print(f"SUCCESS:{output_file}")
    except Exception as e:
        print(f"ERROR:{str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate TTS using Edge TTS")
    parser.add_argument("--text", required=True, help="Text to synthesize")
    parser.add_argument("--voice", required=True, help="Voice to use (e.g., en-US-AriaNeural)")
    parser.add_argument("--output", required=True, help="Output MP3 file path")
    
    args = parser.parse_args()
    
    # Ensure output directory exists
    os.makedirs(os.path.dirname(os.path.abspath(args.output)), exist_ok=True)
    
    asyncio.run(generate_audio(args.text, args.voice, args.output))
