import winsound
import time

def play_buzzer():
    # Frequency, Duration
    winsound.Beep(1000, 500)
    time.sleep(0.1)
    winsound.Beep(1000, 500)
    time.sleep(0.1)
    winsound.Beep(1500, 1000)

if __name__ == "__main__":
    play_buzzer()
