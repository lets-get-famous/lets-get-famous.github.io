using UnityEngine;
using UnityEngine.Video;
using UnityEngine.UI;

public class IntroVideoPlayer : MonoBehaviour
{
    [Header("References")]
    [SerializeField] private VideoPlayer videoPlayer;
    [SerializeField] private GameObject videoContainer; // Panel or RawImage parent

    private void Start()
    {
        if (videoPlayer == null)
        {
            Debug.LogError("VideoPlayer not assigned.");
            return;
        }

        // Make sure video plays once
        videoPlayer.isLooping = false;

        // Subscribe to event
        videoPlayer.loopPointReached += OnVideoFinished;

        // Show and play
        videoContainer.SetActive(true);
        videoPlayer.Play();
    }

    private void OnVideoFinished(VideoPlayer vp)
    {
        Debug.Log("Intro video finished");

        // Hide the video UI
        videoContainer.SetActive(false);

        // Optional: stop & cleanup
        vp.Stop();
        vp.loopPointReached -= OnVideoFinished;
    }
}
